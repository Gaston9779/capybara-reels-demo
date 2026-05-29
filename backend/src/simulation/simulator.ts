import type { SimulateRequest, SimulateResponse } from "../../../shared/contracts/api.js";
import type { Bet, BonusState } from "../../../shared/types/game.js";
import { GAME_CONFIG } from "../config/gameConfig.js";
import { buildGrid, evaluatePaylines, evaluateScatter, normalizeBet } from "../math/paylines.js";
import { triggerFreeSpins } from "../bonus/freeSpins.js";
import { createDeterministicRng } from "../rng/deterministicRng.js";

export function runSimulation(request: SimulateRequest): SimulateResponse {
  const spins = clampSpinCount(request.spins);
  const bet = normalizeBet(request.bet ?? { coinValue: 5, betLevel: 2 }, GAME_CONFIG);
  let totalBet = 0;
  let totalWin = 0;
  let hitCount = 0;
  let bonusCount = 0;
  let maxObservedWinX = 0;
  let bonus: BonusState | null = null;
  const distribution: Record<string, number> = {};
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
    const multiplier = bonus?.currentMultiplier ?? 1;
    const lines = evaluatePaylines(GAME_CONFIG, grid, activeBet);
    const scatter = evaluateScatter(GAME_CONFIG, grid, activeBet);
    const freeSpins = triggerFreeSpins(scatter.count, GAME_CONFIG);
    const win = Math.min(Math.round((lines.totalWin + scatter.win) * multiplier), activeBet.totalBet * GAME_CONFIG.targets.maxWinX);

    if (!isFreeSpin) totalBet += activeBet.totalBet;
    totalWin += win;
    if (win > 0) hitCount++;
    if (freeSpins.triggered) bonusCount++;
    maxObservedWinX = Math.max(maxObservedWinX, win / activeBet.totalBet);
    returns.push(win / activeBet.totalBet);
    distribution[bucketWin(win / activeBet.totalBet)] = (distribution[bucketWin(win / activeBet.totalBet)] ?? 0) + 1;

    if (freeSpins.triggered || isFreeSpin) {
      bonus = bonus ?? { remaining: 0, awarded: 0, currentMultiplier: 1, totalBonusWin: 0, originalBet: activeBet };
      bonus.remaining += freeSpins.awarded;
      bonus.awarded += freeSpins.awarded;
      if (isFreeSpin) {
        bonus.remaining = Math.max(0, bonus.remaining - 1);
        bonus.totalBonusWin += win;
        if (win > 0) bonus.currentMultiplier = Math.min(GAME_CONFIG.freeSpins.maxMultiplier, bonus.currentMultiplier + 1);
      }
      if (bonus.remaining <= 0) bonus = null;
    }
  }

  return {
    spins,
    baseSpins: Math.max(1, totalBet / bet.totalBet),
    rtp: totalWin / Math.max(1, totalBet),
    hitFrequency: hitCount / spins,
    bonusFrequency: bonusCount / spins,
    maxObservedWinX,
    volatilityIndex: standardDeviation(returns),
    distribution
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
