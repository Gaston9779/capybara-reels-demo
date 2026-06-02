import type { BuyBonusRequest, InitRequest, InitResponse, SpinRequest, SpinResponse } from "../../../shared/contracts/api.js";
import type { Bet, BonusState, Grid, RoundRecord, SessionState, SpinResult, WheelResult } from "../../../shared/types/game.js";
import { createBonusWheelEngine } from "../bonus/bonusWheel.js";
import { retriggerFreeSpins, triggerFreeSpins } from "../bonus/freeSpins.js";
import { GAME_CONFIG, type GameConfig } from "../config/gameConfig.js";
import { buildGrid, evaluatePaylines, evaluateScatter, normalizeBet, validateBet } from "../math/paylines.js";
import { createDeterministicRng } from "../rng/deterministicRng.js";
import { MemoryRoundStore } from "../storage/memoryRoundStore.js";

let idSequence = 0;

export class SpinEngine {
  // Rotating daily seed for demo reproducibility and basic unpredictability.
  private readonly serverSeed = `treasure-reels-demo-seed-${new Date().toISOString().slice(0, 10)}`;
  private readonly wheelEngine;

  constructor(
    private readonly store = new MemoryRoundStore(),
    private readonly config: GameConfig = GAME_CONFIG
  ) {
    this.wheelEngine = createBonusWheelEngine(this.config.bonusWheel);
  }

  init(request: InitRequest = {}): InitResponse {
    // Session starts with play-money balance and no active bonus.
    const session: SessionState = {
      sessionId: createId("sess"),
      playerId: request.playerId ?? "demo_p_1001",
      balance: this.config.startingBalance,
      currency: request.currency ?? this.config.currency,
      activeBonus: null
    };
    this.store.saveSession(session);
    this.store.audit("SESSION_INIT", session);
    return {
      session,
      game: {
        code: this.config.gameCode,
        configVersion: this.config.version,
        mathVersion: this.config.mathVersion,
        fixedPaylines: this.config.fixedPaylines,
        rows: this.config.rows,
        reels: this.config.reels
      },
      betOptions: {
        coinValues: this.config.coinValues,
        betLevels: this.config.betLevels
      }
    };
  }

  spin(request: SpinRequest): SpinResponse {
    // Idempotency guarantees one logical outcome for one client request key.
    const idemKey = `${request.sessionId}:spin:${request.idempotencyKey}`;
    const replay = this.store.getIdempotent<SpinResponse>(idemKey, request);
    if (replay) return replay;

    const session = this.requireSession(request.sessionId);
    const isFreeSpin = (session.activeBonus?.remaining ?? 0) > 0;
    // During free spins we reuse the original triggering bet.
    const bet = isFreeSpin ? session.activeBonus!.originalBet : normalizeBet(request.bet, this.config);
    validateBet(bet, this.config);

    const balanceBefore = session.balance;
    if (!isFreeSpin) {
      if (session.balance < bet.totalBet) throw new Error("INSUFFICIENT_BALANCE");
      session.balance -= bet.totalBet;
    }

    const roundId = createId("rnd");
    const spinIndex = this.store.rounds.size + 1;
    const result = this.generateSpinResult({
      roundId,
      spinIndex,
      nonce: request.idempotencyKey,
      bet,
      bonusState: session.activeBonus
    });

    if (isFreeSpin) {
      session.balance += this.advanceActiveBonus(session, result, bet);
    } else {
      session.balance += result.totalWin;
      if (result.freeSpins.triggered) {
        const wheelResult = this.generateWheelResult(roundId, spinIndex, request.idempotencyKey);
        result.wheelResult = wheelResult;
        result.wheelMultiplier = wheelResult.multiplier;
        session.activeBonus = this.createBonusState(result, bet, wheelResult);
      }
    }

    const round: RoundRecord = {
      roundId,
      sessionId: session.sessionId,
      timestamp: new Date().toISOString(),
      bet,
      balanceBefore,
      balanceAfter: session.balance,
      gridResult: result.grid,
      reelStops: result.reelStops,
      winningLines: result.winningLines,
      scatter: result.scatter,
      freeSpins: { ...result.freeSpins, remaining: session.activeBonus?.remaining ?? 0 },
      multiplier: result.multiplier,
      totalWin: result.totalWin,
      bonusTriggered: result.freeSpins.triggered && !isFreeSpin,
      wheelResult: result.wheelResult ?? null,
      wheelMultiplier: result.wheelMultiplier ?? null,
      bonusWinRaw: result.bonusWinRaw ?? 0,
      bonusWinFinal: result.bonusWinFinal ?? 0,
      freeSpinsRemaining: session.activeBonus?.remaining ?? 0,
      mathVersion: this.config.mathVersion,
      configVersion: this.config.version,
      rngSeedOrAuditData: resultAudit(result),
      errorsIfAny: [],
      state: result.freeSpins.triggered && !isFreeSpin ? "BONUS_TRIGGERED" : "RESULT_READY",
      mode: isFreeSpin ? "FREE_SPIN" : "BASE"
    };

    this.store.saveSession(session);
    this.store.saveRound(round);
    this.store.audit("SPIN_RESULT", round);

    const response: SpinResponse = {
      roundId,
      timestamp: round.timestamp,
      bet,
      grid: result.grid,
      reelStops: result.reelStops,
      winningLines: result.winningLines,
      scatter: result.scatter,
      freeSpins: round.freeSpins,
      win: result.totalWin,
      bonusTriggered: result.freeSpins.triggered,
      balanceBefore: round.balanceBefore,
      freeSpinsRemaining: round.freeSpinsRemaining,
      balanceAfter: session.balance,
      configVersion: this.config.version,
      mathVersion: this.config.mathVersion,
      rngAuditData: round.rngSeedOrAuditData,
      round
    };
    this.store.setIdempotent(idemKey, request, response);
    return response;
  }

  buyBonus(request: BuyBonusRequest): SpinResponse {
    const idemKey = `${request.sessionId}:buy-bonus:${request.idempotencyKey}`;
    const replay = this.store.getIdempotent<SpinResponse>(idemKey, request);
    if (replay) return replay;

    const session = this.requireSession(request.sessionId);
    if ((session.activeBonus?.remaining ?? 0) > 0) throw new Error("BONUS_ALREADY_ACTIVE");
    const bet = normalizeBet(request.bet, this.config);
    validateBet(bet, this.config);
    const cost = Math.round(bet.totalBet * this.config.buyBonusCostMultiplier);
    if (session.balance < cost) throw new Error("INSUFFICIENT_BALANCE");

    const balanceBefore = session.balance;
    session.balance -= cost;
    const roundId = createId("buy");
    const spinIndex = this.store.rounds.size + 1;
    const result = this.generateBoughtBonusResult({
      roundId,
      spinIndex,
      nonce: request.idempotencyKey,
      bet
    });
    session.balance += result.totalWin;
    const wheelResult = this.generateWheelResult(roundId, spinIndex, request.idempotencyKey);
    result.wheelResult = wheelResult;
    result.wheelMultiplier = wheelResult.multiplier;
    session.activeBonus = this.createBonusState(result, bet, wheelResult);

    const round: RoundRecord = {
      roundId,
      sessionId: session.sessionId,
      timestamp: new Date().toISOString(),
      bet,
      balanceBefore,
      balanceAfter: session.balance,
      gridResult: result.grid,
      reelStops: result.reelStops,
      winningLines: result.winningLines,
      scatter: result.scatter,
      freeSpins: { ...result.freeSpins, remaining: session.activeBonus?.remaining ?? 0 },
      multiplier: result.multiplier,
      totalWin: result.totalWin,
      bonusTriggered: true,
      wheelResult: result.wheelResult ?? null,
      wheelMultiplier: result.wheelMultiplier ?? null,
      bonusWinRaw: result.bonusWinRaw ?? 0,
      bonusWinFinal: result.bonusWinFinal ?? 0,
      freeSpinsRemaining: session.activeBonus?.remaining ?? 0,
      mathVersion: this.config.mathVersion,
      configVersion: this.config.version,
      rngSeedOrAuditData: resultAudit(result),
      errorsIfAny: [],
      state: "BONUS_TRIGGERED",
      mode: "BASE"
    };
    this.store.saveSession(session);
    this.store.saveRound(round);
    this.store.audit("BUY_BONUS_RESULT", { cost, round });

    const response = this.roundToSpinResponse(round);
    this.store.setIdempotent(idemKey, request, response);
    return response;
  }

  getRound(roundId: string): RoundRecord {
    const round = this.store.getRound(roundId);
    if (!round) throw new Error("ROUND_NOT_FOUND");
    return round;
  }

  listRounds(limit = 50): RoundRecord[] {
    return this.store.listRounds(limit);
  }

  replayRound(roundId: string): SpinResponse {
    // Demo replay returns persisted round payload as deterministic evidence.
    const round = this.getRound(roundId);
    return {
      roundId: round.roundId,
      timestamp: round.timestamp,
      bet: round.bet,
      grid: round.gridResult,
      reelStops: round.reelStops,
      winningLines: round.winningLines,
      scatter: round.scatter,
      freeSpins: round.freeSpins,
      win: round.totalWin,
      bonusTriggered: round.bonusTriggered,
      balanceBefore: round.balanceBefore,
      featureCost: round.roundId.startsWith("buy_")
        ? Math.round(round.bet.totalBet * this.config.buyBonusCostMultiplier)
        : undefined,
      freeSpinsRemaining: round.freeSpinsRemaining,
      balanceAfter: round.balanceAfter,
      configVersion: round.configVersion,
      mathVersion: round.mathVersion,
      rngAuditData: round.rngSeedOrAuditData,
      round
    };
  }

  private roundToSpinResponse(round: RoundRecord): SpinResponse {
    return {
      roundId: round.roundId,
      timestamp: round.timestamp,
      bet: round.bet,
      grid: round.gridResult,
      reelStops: round.reelStops,
      winningLines: round.winningLines,
      scatter: round.scatter,
      freeSpins: round.freeSpins,
      win: round.totalWin,
      bonusTriggered: round.bonusTriggered,
      balanceBefore: round.balanceBefore,
      featureCost: round.roundId.startsWith("buy_")
        ? Math.round(round.bet.totalBet * this.config.buyBonusCostMultiplier)
        : undefined,
      freeSpinsRemaining: round.freeSpinsRemaining,
      balanceAfter: round.balanceAfter,
      configVersion: round.configVersion,
      mathVersion: round.mathVersion,
      rngAuditData: round.rngSeedOrAuditData,
      round
    };
  }

  version(buildTime: string) {
    return {
      gameCode: this.config.gameCode,
      configVersion: this.config.version,
      mathVersion: this.config.mathVersion,
      buildTime
    };
  }

  getStore(): MemoryRoundStore {
    return this.store;
  }

  private generateSpinResult(input: {
    roundId: string;
    spinIndex: number;
    nonce: string;
    bet: ReturnType<typeof normalizeBet>;
    bonusState: SessionState["activeBonus"];
  }): SpinResult {
    // Deterministic RNG input tuple fully identifies one round outcome.
    const rng = createDeterministicRng({
      serverSeed: this.serverSeed,
      nonce: input.nonce,
      roundId: input.roundId,
      spinIndex: input.spinIndex
    });
    const reelStops = this.config.reelsStrips.map((strip) => Math.floor(rng.next() * strip.length));
    const grid = buildGrid(this.config.reelsStrips, reelStops, this.config.rows);
    const lines = evaluatePaylines(this.config, grid, input.bet);
    const scatter = evaluateScatter(this.config, grid, input.bet);
    const freeSpins = input.bonusState
      ? retriggerFreeSpins(scatter.count, this.config)
      : triggerFreeSpins(scatter.count, this.config);
    const bonusScale = input.bonusState ? this.config.bonusWheel.rawWinScale : 1;
    const wheelMultiplier = input.bonusState?.wheelMultiplier ?? 1;
    const uncappedWin = Math.round((lines.totalWin + scatter.win) * bonusScale * wheelMultiplier);
    const totalWin = Math.min(uncappedWin, input.bet.totalBet * this.config.targets.maxWinX);
    const result: SpinResult = {
      reelStops,
      grid,
      winningLines: lines.wins,
      scatter,
      multiplier: wheelMultiplier,
      freeSpins,
      totalWin,
      wheelResult: input.bonusState?.wheelResult,
      wheelMultiplier: input.bonusState?.wheelMultiplier,
      bonusWinRaw: input.bonusState?.bonusWinRaw ?? 0,
      bonusWinFinal: input.bonusState?.bonusWinFinal ?? 0
    };
    // Keep audit out of public JSON shape but available for persisted round data.
    Object.defineProperty(result, "__audit", { value: rng.audit, enumerable: false });
    return result;
  }

  private generateBoughtBonusResult(input: {
    roundId: string;
    spinIndex: number;
    nonce: string;
    bet: Bet;
  }): SpinResult {
    const base = this.generateSpinResult({
      roundId: input.roundId,
      spinIndex: input.spinIndex,
      nonce: input.nonce,
      bet: input.bet,
      bonusState: null
    });
    const grid = forceThreeScatters(base.grid);
    const scatter = evaluateScatter(this.config, grid, input.bet);
    const freeSpins = triggerFreeSpins(scatter.count, this.config);
    const lines = evaluatePaylines(this.config, grid, input.bet);
    const totalWin = Math.min(lines.totalWin + scatter.win, input.bet.totalBet * this.config.targets.maxWinX);
    const result: SpinResult = {
      reelStops: base.reelStops,
      grid,
      winningLines: lines.wins,
      scatter,
      multiplier: 1,
      freeSpins,
      totalWin,
      bonusWinRaw: 0,
      bonusWinFinal: 0
    };
    Object.defineProperty(result, "__audit", { value: resultAudit(base), enumerable: false });
    return result;
  }

  private requireSession(sessionId: string): SessionState {
    const session = this.store.getSession(sessionId);
    if (!session) throw new Error("INVALID_SESSION");
    return session;
  }

  private generateWheelResult(roundId: string, spinIndex: number, nonce: string): WheelResult {
    const rng = createDeterministicRng({
      serverSeed: this.serverSeed,
      nonce: `${nonce}:bonus-wheel`,
      roundId,
      spinIndex
    });
    return this.wheelEngine.select(rng.next());
  }

  private createBonusState(result: SpinResult, bet: Bet, wheelResult: WheelResult): BonusState {
    return {
      remaining: result.freeSpins.awarded,
      awarded: result.freeSpins.awarded,
      currentMultiplier: this.config.freeSpins.startMultiplier,
      totalBonusWin: 0,
      originalBet: bet,
      wheelResult,
      wheelMultiplier: wheelResult.multiplier,
      bonusWinRaw: 0,
      bonusWinFinal: 0
    };
  }

  private advanceActiveBonus(session: SessionState, result: SpinResult, bet: Bet): number {
    const bonus = session.activeBonus;
    if (!bonus) throw new Error("BONUS_STATE_REQUIRED");

    if (result.freeSpins.triggered) {
      bonus.remaining += result.freeSpins.awarded;
      bonus.awarded += result.freeSpins.awarded;
    }

    bonus.remaining = Math.max(0, bonus.remaining - 1);
    const rawWin = Math.round(result.totalWin / bonus.wheelMultiplier);
    bonus.bonusWinRaw += rawWin;
    bonus.totalBonusWin = bonus.bonusWinRaw;
    bonus.bonusWinFinal += result.totalWin;
    result.bonusWinRaw = bonus.bonusWinRaw;
    result.bonusWinFinal = bonus.bonusWinFinal;
    result.wheelResult = bonus.wheelResult;
    result.wheelMultiplier = bonus.wheelMultiplier;

    if (bonus.remaining > 0) {
      session.activeBonus = bonus;
      return result.totalWin;
    }

    session.activeBonus = null;
    return result.totalWin;
  }
}

function forceThreeScatters(grid: Grid): Grid {
  const clone = grid.map((row) => [...row]) as Grid;
  clone[0][0] = "SCATTER";
  clone[1][2] = "SCATTER";
  clone[2][4] = "SCATTER";
  return clone;
}

function resultAudit(result: SpinResult): RoundRecord["rngSeedOrAuditData"] {
  return (result as SpinResult & { __audit: RoundRecord["rngSeedOrAuditData"] }).__audit;
}

function createId(prefix: string): string {
  idSequence += 1;
  return `${prefix}_${Date.now().toString(36)}_${idSequence.toString(36).padStart(6, "0")}`;
}
