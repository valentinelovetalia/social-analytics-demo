# Social Analytics — StackBlitz Ready

One repo, one command, both servers. Designed to **run natively on StackBlitz** and locally.

## Run on StackBlitz
1. Push this folder to a public GitHub repo.
2. Open: `https://stackblitz.com/fork/github/<YOUR_USERNAME>/<YOUR_REPO>?startScript=dev`
3. StackBlitz installs and runs `npm run dev` which starts:
   - API (Express, port 3001) via `tsx watch server/index.ts`
   - Web (Vite, port 5173) proxied to the API at `/api`

## Run locally
```bash
npm install
npm run dev
# open the preview URL Vite prints (usually http://localhost:5173)
```

## Project layout
- `server/index.ts` — Express API serving `/api/metrics` (mock data by default)
- `src/App.tsx` — React dashboard with cross‑platform charts (recharts)
- `vite.config.ts` — dev server proxy from `/api/*` → `http://localhost:3001`
- `tsconfig.json` — shared TS config for server + web

> Secrets: This demo uses **mock data** in StackBlitz. If you later add real tokens, prefer running locally or on a server—don’t commit secrets.