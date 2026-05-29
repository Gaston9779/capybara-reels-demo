# Treasure Reels Math

## Game Model

- Griglia: 5 rulli x 3 righe.
- Paylines: 20 fisse.
- Simboli: 9 regular, `WILD`, `SCATTER`.
- Wild: sostituisce tutti i simboli regular, non sostituisce Scatter.
- Scatter: 3+ attivano Free Spins.
- Free Spins: moltiplicatore progressivo fino al cap configurato.

## Targets

- RTP target: circa 96%.
- Hit frequency target: 24-28%.
- Bonus frequency target: 0.6-1.0%.
- Max win target: 5,000x.
- Volatilita: medium-high.

## Source Of Truth

La math config vive in `src/config.js` ed e importata dal backend tramite `backend/src/config/gameConfig.ts`. Ogni round salva `configVersion` e `mathVersion`.

## Evaluation Flow

1. Backend genera reel stops con RNG deterministico.
2. `buildGrid` crea la schermata 5x3.
3. `evaluatePaylines` valuta le 20 paylines da sinistra a destra.
4. `applyWilds` sceglie il miglior simbolo pagante considerando Wild.
5. `evaluateScatter` conta Scatter su tutta la griglia.
6. Free Spins e moltiplicatore vengono applicati.
7. Il totale viene cappato al max win configurato.

## Simulation

Comando:

```bash
npm run simulate:backend -- 1000000
```

Output:

- RTP.
- Hit frequency.
- Bonus frequency.
- Max observed win.
- Volatility index.
- Distribution buckets.

Per validazione commerciale servirebbero simulazioni piu lunghe e certificazione math esterna.
