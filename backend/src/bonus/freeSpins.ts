import type { Bet, BonusState, FreeSpinTrigger, SpinResult } from "../../../shared/types/game.js";
import type { GameConfig } from "../config/gameConfig.js";

export function triggerFreeSpins(scatterCount: number, config: GameConfig): FreeSpinTrigger {
  const awarded = config.freeSpins.awards[scatterCount as 3 | 4 | 5] ?? 0;
  return { triggered: awarded > 0, awarded };
}

export function advanceBonusState(
  existing: BonusState | null,
  result: SpinResult,
  bet: Bet,
  config: GameConfig
): BonusState | null {
  let bonus = existing;
  if (result.freeSpins.triggered) {
    bonus = bonus ?? {
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
    if (result.totalWin > 0) {
      bonus.currentMultiplier = Math.min(config.freeSpins.maxMultiplier, bonus.currentMultiplier + config.freeSpins.stepOnWin);
    }
  }
  return bonus && bonus.remaining > 0 ? bonus : null;
}
