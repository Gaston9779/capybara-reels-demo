import type { LineWin } from "../../../shared/types/game.js";

export class PaylineAnimator {
  constructor(private readonly layer: SVGElement) {}

  clear(): void {
    this.layer.replaceChildren();
  }

  show(wins: LineWin[], pointFor: (row: number, reel: number) => { x: number; y: number }): void {
    this.clear();
    for (const win of wins) {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      line.setAttribute("points", win.positions.map(([row, reel]) => {
        const point = pointFor(row, reel);
        return `${point.x},${point.y}`;
      }).join(" "));
      line.setAttribute("class", "payline-stroke");
      this.layer.append(line);
    }
  }
}
