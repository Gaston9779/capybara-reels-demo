import { GAME_CONFIG } from "./config.js";
import { generateSpinResult, normalizeBet } from "./engine.js";

const spins = Number(process.argv[2] || 100000);
const bet = normalizeBet({ coinValue: 5, betLevel: 2 }, GAME_CONFIG);
let totalBet = 0;
let totalWin = 0;
let hits = 0;
let bonuses = 0;
let maxWinX = 0;
let bonusState = null;

for (let i = 0; i < spins; i++) {
  const isFree = bonusState?.remaining > 0;
  const result = generateSpinResult({
    config: GAME_CONFIG,
    bet,
    serverSeed: "simulation-seed-v0",
    seedVersion: "sim",
    playerNonce: `sim-${i}`,
    roundId: `sim-round-${i}`,
    spinIndex: i,
    bonusState
  });

  if (!isFree) totalBet += bet.totalBet;
  totalWin += result.totalWin;
  if (result.totalWin > 0) hits += 1;
  if (result.freeSpins.triggered) bonuses += 1;
  maxWinX = Math.max(maxWinX, result.totalWin / bet.totalBet);

  if (result.freeSpins.triggered || isFree) {
    bonusState = bonusState || {
      remaining: 0,
      awarded: 0,
      currentMultiplier: 1,
      totalBonusWin: 0,
      originalBet: bet
    };
    bonusState.remaining += result.freeSpins.awarded;
    bonusState.awarded += result.freeSpins.awarded;
    if (isFree) {
      bonusState.remaining = Math.max(0, bonusState.remaining - 1);
      if (result.totalWin > 0) bonusState.currentMultiplier = Math.min(5, bonusState.currentMultiplier + 1);
    }
    if (bonusState.remaining <= 0) bonusState = null;
  }
}

console.log(JSON.stringify({
  configVersion: GAME_CONFIG.version,
  spins,
  rtp: totalWin / totalBet,
  hitFrequency: hits / spins,
  bonusFrequency: bonuses / spins,
  maxObservedWinX: maxWinX
}, null, 2));
