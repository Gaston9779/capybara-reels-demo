import { strict as assert } from "node:assert";
import { GAME_CONFIG } from "../config/gameConfig.js";
import { normalizeBet, validateBet } from "../math/paylines.js";
import { createDeterministicRng } from "../rng/deterministicRng.js";
import { runSimulation } from "../simulation/simulator.js";
import { SpinEngine } from "../spin-engine/spinEngine.js";

const engine = new SpinEngine();
const init = engine.init({ playerId: "test_player", currency: "EUR" });
const bet = { coinValue: init.betOptions.coinValues[0], betLevel: init.betOptions.betLevels[1] };
const request = { sessionId: init.session.sessionId, idempotencyKey: "idem-1", bet };

const firstSpin = engine.spin(request);
const replayedSpin = engine.spin(request);
assert.deepEqual(replayedSpin, firstSpin);
assert.equal(firstSpin.configVersion, GAME_CONFIG.version);
assert.equal(firstSpin.mathVersion, GAME_CONFIG.mathVersion);
assert.equal(firstSpin.round.scatter.count, firstSpin.scatter.count);
assert.equal(firstSpin.round.freeSpins.remaining, firstSpin.freeSpins.remaining);

assert.throws(() => validateBet(normalizeBet({ coinValue: 999, betLevel: 999 }, GAME_CONFIG), GAME_CONFIG), /INVALID_BET/);

const rngA = createDeterministicRng({ serverSeed: "seed", nonce: "nonce", roundId: "round", spinIndex: 1 });
const rngB = createDeterministicRng({ serverSeed: "seed", nonce: "nonce", roundId: "round", spinIndex: 1 });
assert.deepEqual([rngA.next(), rngA.next(), rngA.next()], [rngB.next(), rngB.next(), rngB.next()]);

const replay = engine.replayRound(firstSpin.roundId);
assert.deepEqual(replay.round, firstSpin.round);

const simulation = runSimulation({ spins: 20_000, bet, seed: "provider-flow" });
assert.ok(simulation.rtp > 0.5 && simulation.rtp < 1.6);
assert.ok(simulation.hitFrequency > 0.15 && simulation.hitFrequency < 0.45);
assert.ok(simulation.bonusFrequency > 0.001 && simulation.bonusFrequency < 0.03);

console.log("provider flow test passed");
