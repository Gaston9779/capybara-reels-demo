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

export type GameState =
  | "IDLE"
  | "BETTING"
  | "SPIN_REQUESTED"
  | "SPINNING"
  | "RESULT_READY"
  | "WIN_PRESENTATION"
  | "BONUS_TRIGGERED"
  | "FREE_SPINS"
  | "COLLECT"
  | "ERROR";

export type Bet = {
  coinValue: number;
  betLevel: number;
  paylines: number;
  lineBet: number;
  totalBet: number;
};

export type LineWin = {
  paylineIndex: number;
  symbol: SymbolId;
  count: number;
  lineBet: number;
  multiplier: number;
  win: number;
  positions: [number, number][];
};

export type ScatterResult = {
  count: number;
  multiplier: number;
  win: number;
  triggered: boolean;
};

export type FreeSpinResult = {
  triggered: boolean;
  awarded: number;
};

export type BonusState = {
  remaining: number;
  awarded: number;
  currentMultiplier: number;
  totalBonusWin: number;
  originalBet: Bet;
};

export type SpinResult = {
  reelStops: number[];
  screen: SymbolId[][];
  lineWins: LineWin[];
  scatter: ScatterResult;
  multiplier: number;
  freeSpins: FreeSpinResult;
  totalWin: number;
};

export type ApiErrorCode =
  | "INVALID_GAME_CODE"
  | "PLAYER_NOT_FOUND"
  | "INVALID_BET"
  | "INVALID_SESSION"
  | "ROUND_IN_PROGRESS"
  | "IDEMPOTENCY_CONFLICT"
  | "INSUFFICIENT_BALANCE"
  | "ROUND_NOT_FOUND"
  | "ROUND_NOT_COLLECTABLE"
  | "ROUND_ALREADY_COLLECTED"
  | "SPIN_PROCESSING_ERROR";
