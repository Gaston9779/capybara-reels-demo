import type { Bet, BonusState, FreeSpinTrigger, SpinResult, WheelResult } from "../../../shared/types/game.js";
import type { GameConfig } from "../config/gameConfig.js";

export function triggerFreeSpins(scatterCount: number, config: GameConfig): FreeSpinTrigger {
  const awarded = config.freeSpins.awards[scatterCount as 3 | 4 | 5] ?? 0;
  return { triggered: awarded > 0, awarded };
}

export function retriggerFreeSpins(scatterCount: number, config: GameConfig): FreeSpinTrigger {
  const awarded = scatterCount >= 3
    ? config.bonusRetrigger.threePlusScatterAward
    : scatterCount === 2
      ? config.bonusRetrigger.twoScatterAward
      : 0;
  return { triggered: awarded > 0, awarded };
}

export function advanceBonusState(
  existing: BonusState | null,
  result: SpinResult,
  bet: Bet,
  config: GameConfig,
  wheelResult?: WheelResult
): BonusState | null {
  let bonus = existing;
  if (result.freeSpins.triggered) {
    if (!bonus && !wheelResult) throw new Error("BONUS_WHEEL_RESULT_REQUIRED");
    bonus = bonus ?? {
      remaining: 0,
      awarded: 0,
      currentMultiplier: config.freeSpins.startMultiplier,
      totalBonusWin: 0,
      originalBet: bet,
      wheelResult: wheelResult!,
      wheelMultiplier: wheelResult!.multiplier,
      bonusWinRaw: 0,
      bonusWinFinal: 0
    };
    bonus.remaining += result.freeSpins.awarded;
    bonus.awarded += result.freeSpins.awarded;
  }
  if (bonus && existing) {
    bonus.remaining = Math.max(0, bonus.remaining - 1);
    bonus.bonusWinRaw += result.totalWin;
    bonus.totalBonusWin = bonus.bonusWinRaw;
  }
  return bonus && bonus.remaining > 0 ? bonus : null;
}
