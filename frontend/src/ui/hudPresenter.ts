import type { MoneyCents } from "../../../shared/types/game.js";

export function formatEuro(cents: MoneyCents): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export class HudPresenter {
  constructor(
    private readonly balanceEl: HTMLElement,
    private readonly winEl: HTMLElement,
    private readonly spinButton: HTMLButtonElement
  ) {}

  setBalance(balance: MoneyCents): void {
    this.balanceEl.textContent = formatEuro(balance);
  }

  setWin(win: MoneyCents): void {
    this.winEl.textContent = formatEuro(win);
  }

  setLocked(locked: boolean): void {
    this.spinButton.disabled = locked;
  }
}
