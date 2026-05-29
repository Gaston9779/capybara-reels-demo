import type { Grid, SymbolId } from "../../../shared/types/game.js";

export interface SymbolRenderer {
  setSymbol(row: number, reel: number, symbol: SymbolId): void;
  setRolling(reel: number, rolling: boolean): void;
}

export class ReelAnimator {
  constructor(private readonly renderer: SymbolRenderer) {}

  async animateToGrid(grid: Grid): Promise<void> {
    for (let reel = 0; reel < grid[0].length; reel++) this.renderer.setRolling(reel, true);
    for (let reel = 0; reel < grid[0].length; reel++) {
      await wait(220 + reel * 130);
      for (let row = 0; row < grid.length; row++) this.renderer.setSymbol(row, reel, grid[row][reel]);
      this.renderer.setRolling(reel, false);
    }
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
