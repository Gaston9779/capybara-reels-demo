import type { BonusRetriggerConfig, BonusWheelConfig, Payline, SymbolId } from "../../../shared/types/game.js";

// Symbol metadata is UI-facing (labels/icons/classes) but kept server-side to
// avoid duplicated “game definition” between frontend and backend.
export interface SymbolMeta {
  label: string;
  glyph: string;
  className: string;
  icon?: string;
}

export interface GameConfig {
  gameCode: string;
  version: string;
  mathVersion: string;
  reels: number;
  rows: number;
  fixedPaylines: number;
  paytableScale: number;
  currency: "EUR";
  coinValues: number[];
  betLevels: number[];
  startingBalance: number;
  paytable: Record<string, Partial<Record<3 | 4 | 5, number>>>;
  scatterPaytable: Partial<Record<3 | 4 | 5, number>>;
  symbols: Record<SymbolId, SymbolMeta>;
  freeSpins: {
    awards: Partial<Record<3 | 4 | 5, number>>;
    startMultiplier: number;
    maxMultiplier: number;
    stepOnWin: number;
  };
  bonusRetrigger: BonusRetriggerConfig;
  bonusWheel: BonusWheelConfig;
  buyBonusCostMultiplier: number;
  paylines: Payline[];
  reelsStrips: SymbolId[][];
  targets: {
    rtp: number;
    hitFrequencyRange: [number, number];
    bonusFrequencyRange: [number, number];
    maxWinX: number;
    volatility: string;
  };
}

export const GAME_CONFIG: GameConfig = {
  gameCode: "treasure_reels",
  version: "treasure-reels-v0.1.0",
  mathVersion: "treasure-reels-math-v0.2.0",
  reels: 5,
  rows: 3,
  fixedPaylines: 20,
  paytableScale: 34.3,
  // Design targets used during math balancing/simulation.
  targets: {
    rtp: 0.96,
    hitFrequencyRange: [0.24, 0.28],
    bonusFrequencyRange: [0.006, 0.01],
    maxWinX: 5000,
    volatility: "medium-high"
  },
  currency: "EUR",
  // Allowed stake space. Frontend should still trust /init betOptions from backend.
  coinValues: [1],
  betLevels: [1, 2, 3, 4, 5, 10, 25, 50, 100, 250, 500, 1000],
  startingBalance: 100000,
  symbols: {
    N1: { label: "A", glyph: "A", className: "low classic" },
    N2: { label: "10", glyph: "10", className: "low classic" },
    N3: { label: "K", glyph: "K", className: "low classic" },
    N4: { label: "Numero 4", glyph: "4", className: "low" },
    N5: { label: "Numero 5", glyph: "5", className: "low" },
    N6: { label: "Numero 6", glyph: "6", className: "high" },
    N7: { label: "Numero 7", glyph: "7", className: "high" },
    N8: { label: "Numero 8", glyph: "8", className: "high" },
    N9: { label: "Numero 9", glyph: "9", className: "premium" },
    WILD: { label: "Wild", glyph: "WILD", icon: "mdi:star-four-points", className: "wild" },
    SCATTER: { label: "Scatter", glyph: "SCATTER", icon: "mdi:treasure-chest", className: "scatter" }
  },
  paytable: {
    // Multipliers are line-based and multiplied by lineBet * paytableScale.
    N1: { 4: 1, 5: 2.5 },
    N2: { 4: 1.2, 5: 3 },
    N3: { 3: 0.5, 4: 1.5, 5: 4 },
    N4: { 3: 0.6, 4: 2, 5: 5 },
    N5: { 3: 0.8, 4: 2.5, 5: 6 },
    N6: { 3: 1, 4: 4, 5: 10 },
    N7: { 3: 1.5, 4: 5, 5: 15 },
    N8: { 3: 2, 4: 8, 5: 25 },
    N9: { 3: 3, 4: 12, 5: 50 },
    WILD: { 3: 3, 4: 12, 5: 50 }
  },
  scatterPaytable: { 3: 2, 4: 10, 5: 50 },
  // Bonus wins are multiplied only by the wheel result. These fields stay for
  // contract compatibility but do not compound the wheel multiplier.
  freeSpins: {
    awards: { 3: 8, 4: 10, 5: 12 },
    startMultiplier: 1,
    maxMultiplier: 1,
    stepOnWin: 0
  },
  bonusRetrigger: {
    twoScatterAward: 2,
    threePlusScatterAward: 4
  },
  bonusWheel: {
    segments: [
      { multiplier: 2, weight: 5600 },
      { multiplier: 3, weight: 2400 },
      { multiplier: 4, weight: 1120 },
      { multiplier: 5, weight: 500 },
      { multiplier: 6, weight: 200 },
      { multiplier: 7, weight: 90 },
      { multiplier: 8, weight: 45 },
      { multiplier: 9, weight: 30 },
      { multiplier: 10, weight: 15 }
    ],
    // Bonus wins must stay consistent with the paytable shown in UI.
    rawWinScale: 1
  },
  buyBonusCostMultiplier: 31.5,
  paylines: [
    // 20 fixed paylines, each entry is [rowReel1..rowReel5].
    [1, 1, 1, 1, 1],
    [0, 0, 0, 0, 0],
    [2, 2, 2, 2, 2],
    [0, 1, 2, 1, 0],
    [2, 1, 0, 1, 2],
    [0, 0, 1, 0, 0],
    [2, 2, 1, 2, 2],
    [1, 0, 0, 0, 1],
    [1, 2, 2, 2, 1],
    [0, 1, 1, 1, 0],
    [2, 1, 1, 1, 2],
    [1, 0, 1, 0, 1],
    [1, 2, 1, 2, 1],
    [0, 1, 0, 1, 0],
    [2, 1, 2, 1, 2],
    [0, 2, 0, 2, 0],
    [2, 0, 2, 0, 2],
    [1, 1, 0, 1, 1],
    [1, 1, 2, 1, 1],
    [0, 2, 2, 2, 0]
  ],
  reelsStrips: [
    // Reel strips drive symbol frequency and therefore RTP/volatility.
    ["N1", "N2", "N6", "N4", "N5", "N3", "SCATTER", "N2", "N7", "N1", "N4", "N5", "WILD", "N3", "N1", "N8", "N2", "N5", "N6", "N4", "N1", "N3", "N9", "N2", "N5", "N7", "N1", "N4", "N6", "N3", "N2", "N5", "N1", "N8", "N4", "N3", "N7", "N2", "N1", "WILD", "N5", "N4", "N6", "N3", "SCATTER", "N2", "N9", "N1"],
    ["N2", "N1", "N5", "N6", "N3", "N4", "N7", "N2", "SCATTER", "N1", "N5", "N4", "N3", "N8", "N2", "WILD", "N1", "N6", "N5", "N4", "N3", "N9", "N2", "N7", "N1", "N5", "N4", "N3", "N6", "N2", "N1", "N8", "N5", "N4", "WILD", "N3", "N2", "N7", "N1", "N5", "N6", "N4", "N3", "SCATTER", "N2", "N1", "N9", "N5"],
    ["N5", "N2", "N1", "N4", "N6", "N3", "N7", "N5", "N2", "SCATTER", "N1", "N4", "N8", "N3", "N2", "N9", "N5", "N1", "N6", "N4", "N3", "N2", "N7", "N5", "N1", "N4", "N6", "N3", "WILD", "N2", "N9", "N5", "N1", "N8", "N4", "N3", "N2", "N7", "N5", "N1", "N6", "N4", "SCATTER", "N3", "N2", "N9", "N5", "N1"],
    ["N4", "N5", "N2", "N1", "N6", "N3", "N7", "N4", "N5", "N2", "N1", "N8", "N3", "N9", "N4", "N5", "N6", "N2", "N1", "N3", "N7", "N4", "N5", "WILD", "N2", "N1", "N8", "N3", "N9", "N4", "N5", "N6", "N2", "N1", "N3", "N7", "N4", "N5", "SCATTER", "N2", "N1", "N8", "N3", "N9", "N4", "N5", "N6", "N2"],
    ["N3", "N4", "N5", "N2", "N1", "N6", "N7", "N3", "N4", "N5", "N2", "N8", "N1", "N9", "N3", "N4", "N5", "N6", "N2", "N1", "N7", "N3", "N4", "N5", "WILD", "N2", "N1", "N8", "N3", "N9", "N4", "N5", "N6", "N2", "N1", "N7", "N3", "N4", "SCATTER", "N5", "N2", "N1", "N8", "N3", "N9", "N4", "N5", "N6"]
  ]
};
