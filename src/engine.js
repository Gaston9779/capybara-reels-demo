import { GAME_CONFIG } from "./config.js";

const enc = new TextEncoder();

export class DemoGameServer {
  constructor(config = GAME_CONFIG) {
    // In-memory stores for local/demo backend simulation.
    this.config = config;
    this.sessions = new Map();
    this.rounds = new Map();
    this.idempotency = new Map();
    this.auditLogs = [];
    // Seed info used to make spin generation deterministic and auditable.
    this.seedVersion = "demo-seed-v1";
    this.serverSeed = `treasure-reels-local-demo-${new Date().toISOString().slice(0, 10)}`;
  }

  init({ playerId = "demo_p_1001", locale = "it-IT", currency = "EUR" } = {}) {
    const sessionId = makeId("sess");
    const session = {
      sessionId,
      playerId,
      locale,
      currency,
      balance: this.config.startingBalance,
      status: "OPEN",
      activeBonus: null
    };
    this.sessions.set(sessionId, session);
    // Keep session creation in audit trail for replay/debug.
    this.log("SESSION_INIT", { sessionId, playerId, balance: session.balance });
    return {
      sessionId,
      player: { playerId, balance: session.balance, currency },
      gameConfigVersion: this.config.version,
      betOptions: {
        coinValues: this.config.coinValues,
        betLevels: this.config.betLevels,
        fixedPaylines: this.config.fixedPaylines
      }
    };
  }

  spin(payload) {
    // Idempotency: same key + same payload => exactly same response.
    const session = this.requireSession(payload.sessionId);
    const idemKey = `${payload.sessionId}:spin:${payload.idempotencyKey}`;
    const replay = this.getIdempotent(idemKey, payload);
    if (replay) return replay;

    const isFreeSpin = session.activeBonus?.remaining > 0; 
    // Free spins reuse original trigger bet and do not debit balance.
    const bet = isFreeSpin ? session.activeBonus.originalBet : normalizeBet(payload.bet, this.config);
    if (!isFreeSpin) {
      validateBet(bet, this.config);
      if (session.balance < bet.totalBet) throw gameError("INSUFFICIENT_BALANCE", "Balance demo insufficiente.");
      session.balance -= bet.totalBet;
    }

    const roundId = makeId("rnd");
    const spinIndex = this.rounds.size + 1;
    const playerNonce = payload.idempotencyKey || `${Date.now()}`;
    const result = generateSpinResult({
      config: this.config,
      bet,
      serverSeed: this.serverSeed,
      seedVersion: this.seedVersion,
      playerNonce,
      roundId,
      spinIndex,
      bonusState: session.activeBonus
    });

    const balanceBeforeWin = session.balance;
    // This demo credits wins immediately (no collect flow required by UI).
    session.balance += result.totalWin;

    if (result.freeSpins.triggered || isFreeSpin) {
      session.activeBonus = advanceBonus(session.activeBonus, result, bet, this.config);
    }

    const state = result.freeSpins.triggered && !isFreeSpin ? "BONUS_TRIGGERED" : "RESULT_READY";
    const round = {
      roundId,
      sessionId: session.sessionId,
      configVersion: this.config.version,
      state,
      mode: isFreeSpin ? "FREE_SPINS" : "BASE",
      bet,
      result,
      balanceAfterDebit: balanceBeforeWin,
      balanceBeforeWin,
      balanceAfterWin: session.balance,
      paidImmediately: true,
      audit: {
        seedVersion: this.seedVersion,
        playerNonce,
        spinIndex,
        idempotencyKey: payload.idempotencyKey
      },
      createdAt: new Date().toISOString()
    };
    this.rounds.set(roundId, round);
    this.log("SPIN_RESULT", round);

    const response = {
      roundId,
      sessionId: session.sessionId,
      state,
      balanceAfterDebit: balanceBeforeWin,
      balanceAfterWin: session.balance,
      bet,
      result,
      bonusContext: session.activeBonus
    };
    this.setIdempotent(idemKey, payload, response);
    return response;
  }

  collect(payload) {
    // Kept for API compatibility: no-op when paidImmediately is true.
    const session = this.requireSession(payload.sessionId);
    const round = this.rounds.get(payload.roundId);
    if (!round) throw gameError("ROUND_NOT_FOUND", "Round non trovato.");

    const idemKey = `${payload.sessionId}:collect:${payload.idempotencyKey}`;
    const replay = this.getIdempotent(idemKey, payload);
    if (replay) return replay;

    if (round.state === "COLLECT") return this.roundToCollectResponse(session, round, 0);
    if (round.paidImmediately) return this.roundToCollectResponse(session, round, 0);
    const canCollect = !session.activeBonus || session.activeBonus.remaining <= 0;
    if (!canCollect) throw gameError("ROUND_NOT_COLLECTABLE", "Free Spins ancora attivi.");

    const collectedWin = this.getUncollectedSessionWin(session.sessionId);
    const before = session.balance;
    session.balance += collectedWin;
    for (const r of this.rounds.values()) {
      if (r.sessionId === session.sessionId && r.state !== "COLLECT") r.state = "COLLECT";
    }

    const response = {
      roundId: payload.roundId,
      collectedWin,
      balanceBeforeCollect: before,
      balanceAfterCollect: session.balance,
      state: "COLLECT"
    };
    this.log("COLLECT", response);
    this.setIdempotent(idemKey, payload, response);
    return response;
  }

  getRound(roundId) {
    const round = this.rounds.get(roundId);
    if (!round) throw gameError("ROUND_NOT_FOUND", "Round non trovato.");
    return round;
  }

  rollback({ roundId, reason = "DEMO_ROLLBACK" }) {
    const round = this.rounds.get(roundId);
    if (!round) throw gameError("ROUND_NOT_FOUND", "Round non trovato.");
    if (round.state === "COLLECT") throw gameError("ROUND_ALREADY_COLLECTED", "Round gia incassato.");
    round.state = "ROLLED_BACK";
    this.log("ROLLBACK", { roundId, reason });
    return { roundId, rolledBack: true, state: "ROLLED_BACK" };
  }

  requireSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== "OPEN") throw gameError("INVALID_SESSION", "Sessione non valida.");
    return session;
  }

  getUncollectedSessionWin(sessionId) {
    let total = 0;
    for (const round of this.rounds.values()) {
      if (round.sessionId === sessionId && !round.paidImmediately && round.state !== "COLLECT" && round.state !== "ROLLED_BACK") {
        total += round.result.totalWin;
      }
    }
    return Math.round(total);
  }

  getIdempotent(key, payload) {
    const existing = this.idempotency.get(key);
    if (!existing) return null;
    if (existing.payloadHash !== stableHash(payload)) throw gameError("IDEMPOTENCY_CONFLICT", "Payload diverso per stessa idempotency key.");
    return existing.response;
  }

  setIdempotent(key, payload, response) {
    this.idempotency.set(key, { payloadHash: stableHash(payload), response });
  }

  roundToCollectResponse(session, round, collectedWin) {
    return {
      roundId: round.roundId,
      collectedWin,
      balanceBeforeCollect: session.balance,
      balanceAfterCollect: session.balance,
      state: "COLLECT"
    };
  }

  log(eventType, payload) {
    this.auditLogs.push(createAuditLog({ eventType, payload }));
    if (this.auditLogs.length > 50) this.auditLogs.shift();
  }
}

export function validateBet(bet, config = GAME_CONFIG) {
  // Backend-side hard validation against configured stake matrix.
  if (!bet || bet.totalBet <= 0) throw gameError("INVALID_BET", "Puntata non valida.");
  if (!config.coinValues.includes(bet.coinValue)) throw gameError("INVALID_BET", "Coin value non ammesso.");
  if (!config.betLevels.includes(bet.betLevel)) throw gameError("INVALID_BET", "Bet level non ammesso.");
  const expected = bet.coinValue * bet.betLevel * config.fixedPaylines;
  if (bet.totalBet !== expected) throw gameError("INVALID_BET", "Total bet non coerente.");
}

export function normalizeBet(bet, config = GAME_CONFIG) {
  // Stake normalization formula:
  // totalBet = coinValue * betLevel * fixedPaylines
  const normalized = {
    coinValue: Number(bet?.coinValue ?? config.coinValues[0]),
    betLevel: Number(bet?.betLevel ?? config.betLevels[0]),
    paylines: config.fixedPaylines
  };
  normalized.totalBet = normalized.coinValue * normalized.betLevel * normalized.paylines;
  normalized.lineBet = normalized.totalBet / normalized.paylines;
  return normalized;
}

export function generateSpinResult(ctx) {
  // Deterministic seed tuple for audit/replay in demo mode.
  const rng = createRng(`${ctx.serverSeed}:${ctx.playerNonce}:${ctx.roundId}:${ctx.spinIndex}`);
  const reelStops = ctx.config.reelsStrips.map((strip) => Math.floor(rng() * strip.length));
  const screen = buildScreen(ctx.config.reelsStrips, reelStops, ctx.config.rows);
  const multiplier = ctx.bonusState?.currentMultiplier ?? 1;
  const lineResult = evaluatePaylines(screen, ctx.config.paylines, ctx.bet.lineBet, ctx.config.paytable, ctx.config.paytableScale);
  const scatter = evaluateScatter(screen, ctx.bet.totalBet, ctx.config.scatterPaytable);
  // Free-spin wins are multiplied by the backend Bonus Wheel in the HTTP engine.
  const preMultiplierWin = lineResult.totalWin + scatter.win;
  const uncappedWin = Math.round(preMultiplierWin * multiplier);
  const maxWin = ctx.bet.totalBet * (ctx.config.targets?.maxWinX ?? Number.POSITIVE_INFINITY);
  const totalWin = Math.min(uncappedWin, maxWin);
  const freeSpins = triggerFreeSpins(scatter.count, ctx.config.freeSpins);
  return {
    reelStops,
    screen,
    lineWins: lineResult.wins,
    scatter,
    multiplier,
    freeSpins,
    totalWin
  };
}

export function evaluatePaylines(screen, paylines, lineBet, paytable, paytableScale = 1) {
  const wins = [];
  paylines.forEach((line, paylineIndex) => {
    const symbols = line.map((row, reel) => screen[row][reel]);
    const resolved = applyWilds(symbols, paytable);
    if (resolved.winMultiplier > 0) {
      wins.push({
        paylineIndex: paylineIndex + 1,
        symbol: resolved.symbol,
        count: resolved.count,
        lineBet,
        multiplier: resolved.winMultiplier,
        win: Math.round(resolved.winMultiplier * lineBet * paytableScale),
        positions: line.slice(0, resolved.count).map((row, reel) => [row, reel])
      });
    }
  });
  return { wins, totalWin: wins.reduce((sum, win) => sum + win.win, 0) };
}

export function evaluateScatter(screen, totalBet, scatterPaytable) {
  // Scatter pays anywhere and can trigger free spins.
  const count = screen.flat().filter((symbol) => symbol === "SCATTER").length;
  const multiplier = scatterPaytable[count] ?? 0;
  return {
    count,
    multiplier,
    win: Math.round(multiplier * totalBet),
    triggered: count >= 3
  };
}

export function applyWilds(symbols, paytable) {
  // Finds the best left-to-right symbol resolution considering wild substitutions.
  let best = { symbol: null, count: 0, winMultiplier: 0 };
  for (const symbol of Object.keys(paytable)) {
    let count = 0;
    for (const current of symbols) {
      if (current === symbol || current === "WILD") count += 1;
      else break;
    }
    const winMultiplier = paytable[symbol]?.[count] ?? 0;
    if (winMultiplier > best.winMultiplier) best = { symbol, count, winMultiplier };
  }
  return best;
}

export function triggerFreeSpins(scatterCount, freeSpinsConfig) {
  const awarded = freeSpinsConfig.awards[scatterCount] ?? 0;
  return {
    triggered: awarded > 0,
    awarded
  };
}

export function advanceBonus(existing, result, bet, config = GAME_CONFIG) {
  // Handles both bonus trigger and per-free-spin state.
  let bonus = existing;
  if (result.freeSpins.triggered) {
    bonus = bonus || {
      remaining: 0,
      awarded: 0,
      currentMultiplier: config.freeSpins.startMultiplier,
      totalBonusWin: 0,
      originalBet: bet
    };
    bonus.remaining += result.freeSpins.awarded;
    bonus.awarded += result.freeSpins.awarded;
  }
  if (bonus && existing) {
    bonus.remaining = Math.max(0, bonus.remaining - 1);
    bonus.totalBonusWin += result.totalWin;
  }
  return bonus && bonus.remaining > 0 ? bonus : null;
}

export function buildScreen(reelStrips, stops, rows) {
  // Converts reel stop indexes to visible matrix [row][reel].
  return Array.from({ length: rows }, (_, row) =>
    reelStrips.map((strip, reel) => strip[(stops[reel] + row) % strip.length])
  );
}

export function createAuditLog({ eventType, payload }) {
  // Canonical hash makes events tamper-evident in debug/audit exports.
  const canonical = stableStringify(payload);
  return {
    auditId: makeId("aud"),
    eventType,
    checksum: stableHash(payload),
    payload,
    canonicalLength: canonical.length,
    createdAt: new Date().toISOString()
  };
}

export function createRng(seed) {
  // Lightweight deterministic PRNG (demo-grade, not certified gambling RNG).
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gameError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function stableHash(value) {
  const bytes = enc.encode(stableStringify(value));
  let h = 2166136261;
  for (const byte of bytes) {
    h ^= byte;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function stableStringify(value) {
  // Stable key ordering is required for deterministic hashing.
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}
