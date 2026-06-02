# Treasure Reels Technical Spec

## Scope

`Treasure Reels` e una slot demo/play-money HTML5 5x3 con 20 paylines fisse, Wild, Scatter, Free Spins e Bonus Wheel x2-x10. Il backend e la source of truth dei risultati; il frontend presenta solo griglia, linee, moltiplicatori e totali ricevuti.

## Architecture

- `backend/src/config/gameConfig.ts`: math pack runtime, paytable, paylines, reel strips, bet options, Bonus Wheel, retrigger e costo buy bonus.
- `src/config.js`: copia frontend per rendering paytable e controlli UI.
- `backend/src/spin-engine/spinEngine.ts`: RNG, round state, idempotenza, audit log, valutazione vincite.
- `src/app.js`: rendering e state machine frontend. Non genera risultati matematici.
- `backend/src/simulation/simulator.ts`: simulatore RTP backend.

## Backend-first rules

- Il client invia una bet e una `idempotencyKey`.
- Il server demo calcola `reelStops`, `screen`, `lineWins`, `scatter`, `freeSpins`, `totalWin`.
- Il frontend anima solo il risultato ricevuto.
- Nel bonus, i retrigger sono calcolati backend-side: 2 Scatter danno +2 giri, 3+ Scatter pagano e danno +4 giri.
- `collect` accredita il balance demo solo quando non ci sono free spins attivi.
- Le chiamate duplicate con stessa idempotency key restituiscono la stessa risposta.

## API shape

```ts
POST /game/init
POST /game/spin
POST /game/collect
GET /game/round/:id
POST /game/rollback
```

Il contratto API espone i risultati calcolati dal backend; il frontend non ricalcola il payout.

## Math targets

- RTP target: 96%, da calibrare con simulazioni lunghe.
- Volatilita: medium-high.
- Hit frequency target: 25-35%.
- Bonus frequency target: circa 1/120-1/180.
- Max win target: 5000x.

La configurazione attuale e una prima build giocabile, non certificata. Prima di vendita o distribuzione regolata servono simulazioni ad alto volume, revisione matematica, asset licensing, compliance e certificazione dove richiesta.
