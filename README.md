# Treasure Reels

Slot HTML5 demo/play-money 5x3 con 20 paylines fisse, Wild, Scatter e Free Spins.

Il progetto ora contiene due livelli:

- `src/`: demo visuale attuale, avviabile subito in browser statico.
- `backend/`, `frontend/`, `shared/`: architettura provider-style TypeScript con contratti, spin engine backend-driven, storage round e simulatore RTP.

Non e un prodotto real-money: niente pagamenti, KYC, AML, wallet reale o integrazione casino.

## Avvio Demo Visuale

Terminale 1:

```bash
npm run api
```

Terminale 2:

```bash
npm run start
```

Apri `http://localhost:5173`.
Il frontend chiama l'API su `http://localhost:3000`; se vuoi cambiare host puoi impostare `window.__GAME_API_URL__` prima di caricare `src/app.js`.

## Backend Demo API

```bash
npm run api
```

Endpoint disponibili:

- `POST /init`
- `POST /spin`
- `GET /round/:id`
- `POST /simulate`

## Simulazione Math

Simulatore legacy, usato dalla demo attuale:

```bash
npm run simulate -- 100000
```

Simulatore backend provider-style:

```bash
npm run simulate:backend -- 1000000
```

Output: RTP, hit frequency, bonus frequency, max win osservato, volatilita stimata e distribuzione vincite.

## Architettura

- Frontend: render, animazioni, UI, network client. Non genera risultati.
- Backend: API, RNG deterministico, spin engine, round history, idempotenza.
- Math engine: paylines, reel strips, Wild, Scatter, Free Spins, simulazione.
- Shared: tipi e contratti API.

Principio chiave: il browser non decide mai l'esito dello spin. Riceve una griglia finale dal backend e la anima.
