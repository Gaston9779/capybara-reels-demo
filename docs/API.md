# Treasure Reels API

Base URL locale: `http://localhost:3000`

La demo usa JSON su HTTP e CORS aperto per semplificare integrazione e deploy statico. Non gestisce denaro reale.

## GET /health

Response:

```json
{ "ok": true }
```

## GET /version

Response:

```json
{
  "gameCode": "treasure_reels",
  "configVersion": "treasure-reels-v0.1.0",
  "mathVersion": "treasure-reels-math-v0.1.0",
  "buildTime": "2026-05-27T11:00:00.000Z"
}
```

## POST /init

Request:

```json
{
  "playerId": "demo_p_1001",
  "locale": "it-IT",
  "currency": "EUR"
}
```

Response include sessione, metadati gioco e `betOptions`. Il frontend deve usare solo questi valori.

## POST /spin

Request:

```json
{
  "sessionId": "sess_abc",
  "idempotencyKey": "spin-1",
  "bet": {
    "coinValue": 1,
    "betLevel": 10
  }
}
```

Response:

```json
{
  "roundId": "rnd_abc",
  "timestamp": "2026-05-27T11:00:00.000Z",
  "bet": { "coinValue": 1, "betLevel": 10, "paylines": 20, "totalBet": 200, "lineBet": 10 },
  "grid": [["N1", "N2", "N3", "N4", "N5"]],
  "reelStops": [1, 2, 3, 4, 5],
  "winningLines": [],
  "scatter": { "count": 0, "multiplier": 0, "win": 0, "triggered": false },
  "freeSpins": { "triggered": false, "awarded": 0, "remaining": 0 },
  "win": 0,
  "bonusTriggered": false,
  "balanceBefore": 100000,
  "balanceAfter": 99800,
  "configVersion": "treasure-reels-v0.1.0",
  "mathVersion": "treasure-reels-math-v0.1.0",
  "rngAuditData": { "algorithm": "fnv1a-mulberry32-demo" },
  "round": {}
}
```

## GET /round/:id

Restituisce il round salvato.

## GET /rounds?limit=50

Restituisce gli ultimi round in memoria. Limite massimo: `250`.

## POST /replay

Request:

```json
{ "roundId": "rnd_abc" }
```

Restituisce lo stesso payload di `/spin` usando il round salvato.

## POST /simulate

Request:

```json
{ "spins": 1000000, "bet": { "coinValue": 1, "betLevel": 10 }, "seed": "demo" }
```

Response include RTP, hit frequency, bonus frequency, max observed win, volatility index e distribuzione vincite.

## Error Codes

- `INVALID_SESSION`: sessione non valida.
- `INVALID_BET`: puntata fuori config.
- `INSUFFICIENT_BALANCE`: saldo demo insufficiente.
- `IDEMPOTENCY_CONFLICT`: stessa idempotency key con payload diverso.
- `ROUND_NOT_FOUND`: round non trovato.
- `ROUND_ID_REQUIRED`: replay senza `roundId`.
