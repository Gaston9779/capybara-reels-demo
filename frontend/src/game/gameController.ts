import type { Bet, Grid, LineWin, MoneyCents } from "../../../shared/types/game.js";
import type { GameApiClient } from "../network/gameApi.js";

export interface ReelView {
  animateToGrid(grid: Grid): Promise<void>;
  highlightWins(wins: LineWin[]): Promise<void>;
}

export interface HudView {
  setBalance(balance: MoneyCents): void;
  setWin(win: MoneyCents): void;
  setLocked(locked: boolean): void;
}

export class GameController {
  private sessionId: string | null = null;

  constructor(
    private readonly api: GameApiClient,
    private readonly reels: ReelView,
    private readonly hud: HudView
  ) {}

  async init(): Promise<void> {
    const response = await this.api.init({ currency: "EUR" });
    this.sessionId = response.session.sessionId;
    this.hud.setBalance(response.session.balance);
    this.hud.setWin(0);
  }

  async spin(bet: Pick<Bet, "coinValue" | "betLevel">): Promise<void> {
    if (!this.sessionId) throw new Error("SESSION_NOT_INITIALIZED");
    this.hud.setLocked(true);
    this.hud.setWin(0);
    const result = await this.api.spin({
      sessionId: this.sessionId,
      idempotencyKey: crypto.randomUUID(),
      bet
    });
    await this.reels.animateToGrid(result.grid);
    await this.reels.highlightWins(result.winningLines);
    this.hud.setWin(result.win);
    this.hud.setBalance(result.balanceAfter);
    this.hud.setLocked(false);
  }
}
