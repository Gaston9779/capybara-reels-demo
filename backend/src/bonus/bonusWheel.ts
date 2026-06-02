import type { BonusMultiplier, BonusWheelConfig, WheelResult } from "../../../shared/types/game.js";

export type BonusWheelEngine = {
  select(randomValue: number): WheelResult;
  averageMultiplier(): number;
  probabilities(): Record<`x${BonusMultiplier}`, number>;
};

export function createBonusWheelEngine(config: BonusWheelConfig): BonusWheelEngine {
  const totalWeight = config.segments.reduce((sum, segment) => sum + segment.weight, 0);
  if (totalWeight <= 0) throw new Error("INVALID_BONUS_WHEEL_WEIGHTS");

  return {
    select(randomValue: number): WheelResult {
      const roll = clampUnit(randomValue) * totalWeight;
      let cursor = 0;
      for (const segment of config.segments) {
        cursor += segment.weight;
        if (roll < cursor) return toWheelResult(segment.multiplier, segment.weight, totalWeight);
      }
      const last = config.segments[config.segments.length - 1];
      return toWheelResult(last.multiplier, last.weight, totalWeight);
    },
    averageMultiplier(): number {
      return config.segments.reduce((sum, segment) => sum + segment.multiplier * segment.weight, 0) / totalWeight;
    },
    probabilities(): Record<`x${BonusMultiplier}`, number> {
      return Object.fromEntries(
        config.segments.map((segment) => [`x${segment.multiplier}`, segment.weight / totalWeight])
      ) as Record<`x${BonusMultiplier}`, number>;
    }
  };
}

export function wheelLabel(multiplier: BonusMultiplier): `x${BonusMultiplier}` {
  return `x${multiplier}`;
}

function toWheelResult(multiplier: BonusMultiplier, weight: number, totalWeight: number): WheelResult {
  return {
    label: wheelLabel(multiplier),
    multiplier,
    weight,
    probability: weight / totalWeight
  };
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(0.999999999, Math.max(0, value));
}
