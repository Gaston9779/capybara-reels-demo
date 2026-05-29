# Deploy Guide

## Local

Terminale backend:

```bash
npm run api
```

Terminale frontend:

```bash
npm run start
```

Apri `http://localhost:5173`.

## Backend Railway Or Render

Command:

```bash
npm run api
```

Env:

- `PORT`: fornita dalla piattaforma.

Endpoint da controllare:

- `GET /health`
- `GET /version`

## Frontend Vercel

La demo frontend e statica. Pubblica root del progetto oppure una cartella statica equivalente.

Prima di `src/app.js`, `index.html` puo configurare:

```html
<script>
  window.__GAME_API_URL__ = "https://your-backend.example.com";
</script>
```

In locale il fallback e `http://localhost:3000`.

## Known Limits

- Storage in memoria.
- RNG demo, non certificato real-money.
- Nessun wallet reale.
- Nessun KYC, AML o integrazione regolatoria.
