import { strict as assert } from "node:assert";
import { GAME_CONFIG } from "../config/gameConfig.js";
import { buildGrid, evaluatePaylines, normalizeBet, validateBet } from "../math/paylines.js";

const bet = normalizeBet({ coinValue: GAME_CONFIG.coinValues[0], betLevel: GAME_CONFIG.betLevels[1] }, GAME_CONFIG);
validateBet(bet, GAME_CONFIG);

const grid = buildGrid(GAME_CONFIG.reelsStrips, [0, 0, 0, 0, 0], GAME_CONFIG.rows);
assert.equal(grid.length, 3);
assert.equal(grid[0].length, 5);

const result = evaluatePaylines(GAME_CONFIG, grid, bet);
assert.ok(Array.isArray(result.wins));
assert.ok(result.totalWin >= 0);

console.log("math smoke test passed");
