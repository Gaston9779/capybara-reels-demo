# Treasure Reels Architecture

## Obiettivo

Questa codebase simula una slot provider-ready ma resta una demo play-money. La separazione serve a dimostrare il flusso reale usato in iGaming: outcome deciso server-side, frontend responsabile solo della presentazione.

## Struttura

- `shared/types`: tipi di dominio comuni tra client e server.
- `shared/contracts`: request/response API.
- `backend/src/rng`: RNG deterministico auditabile per demo.
- `backend/src/math`: payline evaluation, Wild, Scatter, bet validation.
- `backend/src/bonus`: avanzamento Free Spins.
- `backend/src/spin-engine`: orchestration dello spin.
- `backend/src/storage`: round/session store in memoria.
- `backend/src/api`: HTTP API senza dipendenze esterne.
- `backend/src/simulation`: simulatore RTP e volatilita.
- `frontend/src/network`: client API.
- `frontend/src/game`: controller frontend che orchestra richiesta spin e animazione.
- `frontend/src/reels`, `frontend/src/ui`, `frontend/src/animations`: render e presentazione.

## Flusso Spin

1. Il frontend invia `POST /spin` con `sessionId`, `idempotencyKey` e puntata.
2. Il backend valida sessione e puntata.
3. Il backend genera reel stops con RNG deterministico.
4. Il math engine costruisce la griglia 5x3.
5. Il math engine calcola line wins, Scatter e Free Spins.
6. Il backend salva il round con audit data.
7. Il frontend riceve la griglia finale, anima i rulli e mostra la vincita.

## Regole Di Sicurezza Demo

- Nessun RNG frontend.
- Nessun trust nel client.
- Round idempotenti tramite `idempotencyKey`.
- Ogni round conserva griglia, stops, puntata, vincite, config version e RNG audit data.
- Config e math version sono salvate nel record round.

## Limiti Voluti

- Storage in memoria: sostituibile con PostgreSQL.
- RNG demo deterministico: per real-money servirebbe RNG certificato/provider approved.
- Nessun wallet reale.
- Nessuna compliance KYC/AML.
- Nessuna logica di pagamento.
