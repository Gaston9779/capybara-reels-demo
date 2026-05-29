# Treasure Reels Technical Spec

## Scope

`Treasure Reels` e una slot demo/play-money HTML5 5x3 con 20 paylines fisse, Wild, Scatter, Free Spins e moltiplicatore progressivo. Il codice runtime vive in `src/app.js`, `src/engine.js` e `src/config.js`; i tipi contrattuali principali sono in `src/types.ts`.

## Architecture

- `src/config.js`: math pack, paytable, paylines, reel strips, bet options.
- `src/engine.js`: server demo locale, RNG, round state, idempotenza, audit log, valutazione vincite.
- `src/app.js`: rendering e state machine frontend. Non genera risultati matematici.
- `src/simulate.js`: simulatore RTP veloce via Node.

## Backend-first rules

- Il client invia una bet e una `idempotencyKey`.
- Il server demo calcola `reelStops`, `screen`, `lineWins`, `scatter`, `freeSpins`, `totalWin`.
- Il frontend anima solo il risultato ricevuto.
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

Questa demo implementa gli stessi contratti in memoria con `DemoGameServer`, cosi si puo sostituire il trasporto locale con HTTP senza cambiare la math.

## Math targets

- RTP target: 96%, da calibrare con simulazioni lunghe.
- Volatilita: medium-high.
- Hit frequency target: 25-35%.
- Bonus frequency target: circa 1/120-1/180.
- Max win target: 5000x.

La configurazione attuale e una prima build giocabile, non certificata. Prima di vendita o distribuzione regolata servono simulazioni ad alto volume, revisione matematica, asset licensing, compliance e certificazione dove richiesta.
