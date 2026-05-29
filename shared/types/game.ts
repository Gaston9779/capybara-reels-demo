// Shared domain model used by both frontend and backend.
// Keeping these types in one place avoids contract drift between UI and engine.
export type SymbolId =
  | "N1"
  | "N2"
  | "N3"
  | "N4"
  | "N5"
  | "N6"
  | "N7"
  | "N8"
  | "N9"
  | "WILD"
  | "SCATTER";

export type GameMode = "BASE" | "FREE_SPIN";
export type RoundState = "RESULT_READY" | "BONUS_TRIGGERED" | "ROLLED_BACK";

// Money is represented in cents to avoid floating point rounding issues.
export type MoneyCents = number;
export type ReelStops = number[];
// Grid shape is [row][reel] => 3x5 matrix for the current game.
export type Grid = SymbolId[][];
export type Payline = [number, number, number, number, number];

// Concrete stake used for one spin round.
export interface Bet {
  coinValue: MoneyCents;
  betLevel: number;
  paylines: number;
  totalBet: MoneyCents;
  lineBet: MoneyCents;
}

// One winning payline evaluation result.
export interface LineWin {
  paylineIndex: number;
  symbol: SymbolId;
  count: number;
  lineBet: MoneyCents;
  multiplier: number;
  win: MoneyCents;
  positions: Array<[row: number, reel: number]>;
}

// Scatter result is evaluated on full grid (not on paylines).
export interface ScatterResult {
  count: number;
  multiplier: number;
  win: MoneyCents;
  triggered: boolean;
}

// Trigger info emitted by one spin.
export interface FreeSpinTrigger {
  triggered: boolean;
  awarded: number;
}

// Running state of the free spins feature attached to the session.
export interface BonusState {
  remaining: number;
  awarded: number;
  currentMultiplier: number;
  totalBonusWin: MoneyCents;
  originalBet: Bet;
}

// Full math outcome before UI animation/presentation.
export interface SpinResult {
  reelStops: ReelStops;
  grid: Grid;
  winningLines: LineWin[];
  scatter: ScatterResult;
  multiplier: number;
  freeSpins: FreeSpinTrigger;
  totalWin: MoneyCents;
}

// Persisted and audit-friendly representation of a spin round.
export interface RoundRecord {
  roundId: string;
  sessionId: string;
  timestamp: string;
  bet: Bet;
  balanceBefore: MoneyCents;
  balanceAfter: MoneyCents;
  gridResult: Grid;
  reelStops: ReelStops;
  winningLines: LineWin[];
  scatter: ScatterResult;
  freeSpins: FreeSpinTrigger & { remaining: number };
  multiplier: number;
  totalWin: MoneyCents;
  bonusTriggered: boolean;
  freeSpinsRemaining: number;
  mathVersion: string;
  configVersion: string;
  rngSeedOrAuditData: RngAuditData;
  errorsIfAny: string[];
  state: RoundState;
  mode: GameMode;
}

// Minimum data required to deterministically audit a generated round.
export interface RngAuditData {
  algorithm: "fnv1a-mulberry32-demo";
  serverSeedHash: string;
  nonce: string;
  roundId: string;
  spinIndex: number;
}

// Lightweight player session for demo mode (play-money only).
export interface SessionState {
  sessionId: string;
  playerId: string;
  balance: MoneyCents;
  currency: string;
  activeBonus: BonusState | null;
}
