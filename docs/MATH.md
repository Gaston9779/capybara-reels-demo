# Treasure Reels Math

## Game Model

- Griglia: 5 rulli x 3 righe.
- Paylines: 20 fisse.
- Simboli: 9 regular, `WILD`, `SCATTER`.
- Wild: sostituisce tutti i simboli regular, non sostituisce Scatter.
- Scatter: 3+ attivano Free Spins.
- Free Spins: nel base game 3/4/5 Scatter assegnano 8/10/12 giri gratuiti.
- Bonus Retrigger: durante i Free Spins, 2 Scatter assegnano +2 giri senza pagamento Scatter; 3+ Scatter pagano Scatter e assegnano +4 giri.
- Bonus Wheel: all'ingresso del bonus assegna un moltiplicatore x2-x10. Ogni vincita dei Free Spins e moltiplicata solo dal risultato della ruota.
- Buy Bonus: costo configurato lato backend a 31.5x puntata totale.

## Targets

- RTP target: circa 96%.
- Hit frequency target: 24-28%.
- Bonus frequency target: 0.6-1.0%.
- Max win target: 5,000x.
- Volatilita: medium-high.

## Source Of Truth

La source of truth runtime vive nel backend in `backend/src/config/gameConfig.ts`. Il frontend usa `src/config.js` per rendering/paytable e deve restare allineato alla config backend. Ogni round salva `configVersion` e `mathVersion`.

## Evaluation Flow

1. Backend genera reel stops con RNG deterministico.
2. `buildGrid` crea la schermata 5x3.
3. `evaluatePaylines` valuta le 20 paylines da sinistra a destra.
4. `applyWilds` sceglie il miglior simbolo pagante considerando Wild.
5. `evaluateScatter` conta Scatter su tutta la griglia.
6. Nei Free Spins il backend applica il moltiplicatore della Bonus Wheel al totale raw di line wins + Scatter.
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
