import type { Bet, FreeSpinTrigger, Grid, LineWin, MoneyCents, RoundRecord, ScatterResult, SessionState } from "../types/game.js";

// /init request payload: enough to open a demo session with locale/currency context.
export interface InitRequest {
  playerId?: string;
  locale?: string;
  currency?: "EUR";
}

// /init response defines immutable game capabilities for this session.
export interface InitResponse {
  session: SessionState;
  game: {
    code: string;
    configVersion: string;
    mathVersion: string;
    fixedPaylines: number;
    rows: number;
    reels: number;
  };
  betOptions: {
    coinValues: MoneyCents[];
    betLevels: number[];
  };
}

// /spin request: idempotencyKey is mandatory to prevent duplicate rounds.
export interface SpinRequest {
  sessionId: string;
  idempotencyKey: string;
  bet: Pick<Bet, "coinValue" | "betLevel">;
}

// /buy-bonus request: demo feature buy, cost is calculated server-side as 30x totalBet.
export interface BuyBonusRequest {
  sessionId: string;
  idempotencyKey: string;
  bet: Pick<Bet, "coinValue" | "betLevel">;
}

// /spin response is intentionally rich so frontend can animate without extra calls.
export interface SpinResponse {
  roundId: string;
  timestamp: string;
  bet: Bet;
  grid: Grid;
  reelStops: number[];
  winningLines: LineWin[];
  scatter: ScatterResult;
  freeSpins: FreeSpinTrigger & { remaining: number };
  win: MoneyCents;
  bonusTriggered: boolean;
  balanceBefore: MoneyCents;
  // Optional server-authoritative feature charge, used by buy-bonus rounds.
  featureCost?: MoneyCents;
  freeSpinsRemaining: number;
  balanceAfter: MoneyCents;
  configVersion: string;
  mathVersion: string;
  rngAuditData: RoundRecord["rngSeedOrAuditData"];
  round: RoundRecord;
}

// Generic wrapper used by /round/:id.
export interface RoundResponse {
  round: RoundRecord;
}

// Simulator input for quick math sanity validation.
export interface SimulateRequest {
  spins: number;
  bet?: Pick<Bet, "coinValue" | "betLevel">;
  seed?: string;
}

// Simulator output expected by math reviews and balancing iterations.
export interface SimulateResponse {
  spins: number;
  baseSpins: number;
  rtp: number;
  hitFrequency: number;
  bonusFrequency: number;
  maxObservedWinX: number;
  volatilityIndex: number;
  distribution: Record<string, number>;
}

// Standard API error envelope.
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

// Runtime/build metadata for operations and integration checks.
export interface VersionResponse {
  gameCode: string;
  configVersion: string;
  mathVersion: string;
  buildTime: string;
}
