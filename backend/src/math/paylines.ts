import type { Bet, Grid, LineWin, Payline, ScatterResult, SymbolId } from "../../../shared/types/game.js";
import type { GameConfig } from "../config/gameConfig.js";

// Build visible grid by applying stop index per reel and wrapping strip values.
export function buildGrid(reelStrips: SymbolId[][], stops: number[], rows: number): Grid {
  return Array.from({ length: rows }, (_, row) =>
    reelStrips.map((strip, reel) => strip[(stops[reel] + row) % strip.length])
  );
}

// Evaluate all configured paylines left-to-right with wild substitution.
export function evaluatePaylines(config: GameConfig, grid: Grid, bet: Bet): { wins: LineWin[]; totalWin: number } {
  const wins: LineWin[] = [];
  config.paylines.forEach((line, paylineIndex) => {
    const symbols = line.map((row, reel) => grid[row][reel]);
    const resolved = applyWilds(symbols, config.paytable);
    if (resolved.multiplier <= 0 || resolved.symbol === null) return;
    const win = Math.round(resolved.multiplier * bet.lineBet * config.paytableScale);
    wins.push({
      paylineIndex: paylineIndex + 1,
      symbol: resolved.symbol,
      count: resolved.count,
      lineBet: bet.lineBet,
      multiplier: resolved.multiplier,
      win,
      positions: line.slice(0, resolved.count).map((row, reel) => [row, reel])
    });
  });
  return { wins, totalWin: wins.reduce((sum, win) => sum + win.win, 0) };
}

// Resolve the best paying symbol combination on one payline.
export function applyWilds(
  lineSymbols: SymbolId[],
  paytable: GameConfig["paytable"]
): { symbol: SymbolId | null; count: number; multiplier: number } {
  let best: { symbol: SymbolId | null; count: number; multiplier: number } = { symbol: null, count: 0, multiplier: 0 };
  for (const symbol of Object.keys(paytable) as SymbolId[]) {
    // Scatter is evaluated separately and never substitutes on paylines.
    if (symbol === "SCATTER") continue;
    let count = 0;
    for (const current of lineSymbols) {
      if (current === symbol || current === "WILD") count += 1;
      else break;
    }
    const multiplier = paytable[symbol]?.[count as 3 | 4 | 5] ?? 0;
    if (multiplier > best.multiplier) best = { symbol, count, multiplier };
  }
  return best;
}

// Evaluate scatter count on full screen and convert to bet multiplier win.
export function evaluateScatter(config: GameConfig, grid: Grid, bet: Bet): ScatterResult {
  const count = grid.flat().filter((symbol) => symbol === "SCATTER").length;
  const multiplier = config.scatterPaytable[count as 3 | 4 | 5] ?? 0;
  return {
    count,
    multiplier,
    win: Math.round(multiplier * bet.totalBet),
    triggered: count >= 3
  };
}

// Normalize incoming stake values to full internal Bet structure.
export function normalizeBet(input: Pick<Bet, "coinValue" | "betLevel">, config: GameConfig): Bet {
  const bet: Bet = {
    coinValue: Number(input.coinValue),
    betLevel: Number(input.betLevel),
    paylines: config.fixedPaylines,
    totalBet: 0,
    lineBet: 0
  };
  bet.totalBet = bet.coinValue * bet.betLevel * bet.paylines;
  bet.lineBet = bet.totalBet / bet.paylines;
  return bet;
}

// Hard guardrail: backend is the only source of truth for valid stakes.
export function validateBet(bet: Bet, config: GameConfig): void {
  if (!Number.isFinite(bet.totalBet) || bet.totalBet <= 0) throw new Error("INVALID_BET");
  if (!config.coinValues.includes(bet.coinValue)) throw new Error("INVALID_BET");
  if (!config.betLevels.includes(bet.betLevel)) throw new Error("INVALID_BET");
  if (bet.totalBet !== bet.coinValue * bet.betLevel * config.fixedPaylines) throw new Error("INVALID_BET");
}
