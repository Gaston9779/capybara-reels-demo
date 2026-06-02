import type { SimulateRequest, SimulateResponse } from "../../../shared/contracts/api.js";
import type { Bet, BonusState, BonusMultiplier } from "../../../shared/types/game.js";
import { GAME_CONFIG } from "../config/gameConfig.js";
import { buildGrid, evaluatePaylines, evaluateScatter, normalizeBet } from "../math/paylines.js";
import { retriggerFreeSpins, triggerFreeSpins } from "../bonus/freeSpins.js";
import { createBonusWheelEngine } from "../bonus/bonusWheel.js";
import { createDeterministicRng } from "../rng/deterministicRng.js";

export function runSimulation(request: SimulateRequest): SimulateResponse {
  const spins = clampSpinCount(request.spins);
  const bet = normalizeBet(request.bet ?? { coinValue: 5, betLevel: 2 }, GAME_CONFIG);
  const wheelEngine = createBonusWheelEngine(GAME_CONFIG.bonusWheel);
  let totalBet = 0;
  let totalWin = 0;
  let baseWin = 0;
  let bonusFinalWin = 0;
  let hitCount = 0;
  let bonusCount = 0;
  let maxObservedWinX = 0;
  let bonus: BonusState | null = null;
  const distribution: Record<string, number> = {};
  const wheelDistribution = emptyWheelDistribution();
  const returns: number[] = [];

  for (let i = 0; i < spins; i++) {
    const isFreeSpin: boolean = (bonus?.remaining ?? 0) > 0;
    const rng = createDeterministicRng({
      serverSeed: request.seed ?? "simulation-seed",
      nonce: `sim-${i}`,
      roundId: `sim-round-${i}`,
      spinIndex: i
    });
    const reelStops = GAME_CONFIG.reelsStrips.map((strip) => Math.floor(rng.next() * strip.length));
    const grid = buildGrid(GAME_CONFIG.reelsStrips, reelStops, GAME_CONFIG.rows);
    const activeBet: Bet = isFreeSpin ? bonus!.originalBet : bet;
    const lines = evaluatePaylines(GAME_CONFIG, grid, activeBet);
    const scatter = evaluateScatter(GAME_CONFIG, grid, activeBet);
    const freeSpins = isFreeSpin
      ? retriggerFreeSpins(scatter.count, GAME_CONFIG)
      : triggerFreeSpins(scatter.count, GAME_CONFIG);
    const scale = isFreeSpin ? GAME_CONFIG.bonusWheel.rawWinScale : 1;
    const wheelMultiplier = isFreeSpin ? bonus!.wheelMultiplier : 1;
    let win = Math.min(
      Math.round((lines.totalWin + scatter.win) * scale * wheelMultiplier),
      activeBet.totalBet * GAME_CONFIG.targets.maxWinX
    );

    if (!isFreeSpin) {
      totalBet += activeBet.totalBet;
      totalWin += win;
      baseWin += win;
    }
    if (win > 0) hitCount++;
    if (!isFreeSpin && freeSpins.triggered) bonusCount++;
    let creditedWin = win;

    if (freeSpins.triggered || isFreeSpin) {
      if (!bonus) {
        const wheelRng = createDeterministicRng({
          serverSeed: request.seed ?? "simulation-seed",
          nonce: `sim-wheel-${i}`,
          roundId: `sim-round-${i}`,
          spinIndex: i
        });
        const wheelResult = wheelEngine.select(wheelRng.next());
        wheelDistribution[wheelResult.label] += 1;
        bonus = {
          remaining: 0,
          awarded: 0,
          currentMultiplier: GAME_CONFIG.freeSpins.startMultiplier,
          totalBonusWin: 0,
          originalBet: activeBet,
          wheelResult,
          wheelMultiplier: wheelResult.multiplier,
          bonusWinRaw: 0,
          bonusWinFinal: 0
        };
      }
      bonus.remaining += freeSpins.awarded;
      bonus.awarded += freeSpins.awarded;
      if (isFreeSpin) {
        bonus.remaining = Math.max(0, bonus.remaining - 1);
        bonus.bonusWinRaw += Math.round(win / bonus.wheelMultiplier);
        bonus.totalBonusWin = bonus.bonusWinRaw;
        bonus.bonusWinFinal += win;
        totalWin += win;
        bonusFinalWin += win;
        if (bonus.remaining <= 0) {
          bonus = null;
        }
      }
    }

    maxObservedWinX = Math.max(maxObservedWinX, creditedWin / activeBet.totalBet);
    returns.push(creditedWin / activeBet.totalBet);
    distribution[bucketWin(creditedWin / activeBet.totalBet)] = (distribution[bucketWin(creditedWin / activeBet.totalBet)] ?? 0) + 1;
  }

  const totalWheelHits = Object.values(wheelDistribution).reduce((sum, count) => sum + count, 0);
  return {
    spins,
    baseSpins: Math.max(1, totalBet / bet.totalBet),
    rtp: totalWin / Math.max(1, totalBet),
    baseRTP: baseWin / Math.max(1, totalBet),
    bonusRTP: bonusFinalWin / Math.max(1, totalBet),
    finalRTP: totalWin / Math.max(1, totalBet),
    hitFrequency: hitCount / spins,
    bonusFrequency: bonusCount / spins,
    wheelDistribution: Object.fromEntries(
      Object.entries(wheelDistribution).map(([label, count]) => [label, count / Math.max(1, totalWheelHits)])
    ) as Record<`x${BonusMultiplier}`, number>,
    averageMultiplier: wheelEngine.averageMultiplier(),
    maxObservedWinX,
    volatilityIndex: standardDeviation(returns),
    distribution
  };
}

function emptyWheelDistribution(): Record<`x${BonusMultiplier}`, number> {
  return {
    x2: 0,
    x3: 0,
    x4: 0,
    x5: 0,
    x6: 0,
    x7: 0,
    x8: 0,
    x9: 0,
    x10: 0
  };
}

function clampSpinCount(spins: number): number {
  if (!Number.isFinite(spins) || spins <= 0) return 1_000_000;
  return Math.min(Math.floor(spins), 100_000_000);
}

function bucketWin(winX: number): string {
  if (winX <= 0) return "0x";
  if (winX < 1) return "0-1x";
  if (winX < 5) return "1-5x";
  if (winX < 20) return "5-20x";
  if (winX < 100) return "20-100x";
  if (winX < 1000) return "100-1000x";
  return "1000x+";
}

function standardDeviation(values: number[]): number {
  const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, values.length);
  return Math.sqrt(variance);
}
