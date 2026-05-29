# Audit And Replay

## Round Data

Ogni round salva:

- `roundId`
- `sessionId`
- `timestamp`
- `bet`
- `balanceBefore`
- `balanceAfter`
- `gridResult`
- `reelStops`
- `winningLines`
- `scatter`
- `freeSpins`
- `totalWin`
- `configVersion`
- `mathVersion`
- `rngSeedOrAuditData`
- `errorsIfAny`

## Idempotency

`POST /spin` richiede `idempotencyKey`. La stessa key con lo stesso payload restituisce la stessa response. La stessa key con payload diverso genera `IDEMPOTENCY_CONFLICT`.

## Replay

Per demo, `POST /replay` restituisce il round salvato. Questo dimostra la separazione tra risultato matematico e animazione frontend.

## RNG Audit

Il RNG demo salva:

- algoritmo
- hash seed server
- nonce
- round id
- spin index

Per real-money servirebbe RNG certificato e processo di audit regolato.
