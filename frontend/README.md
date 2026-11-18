# CourtIQ Frontend

React 19 + TypeScript + Tailwind v4 + Recharts, built with Vite. See the
[project root README](../README.md) for the full architecture, dataset, API
contract, and setup instructions — this file only covers things specific to
this directory.

```bash
npm install
npm run dev     # http://localhost:5173, needs the backend on :8000
npm run build   # production build (tsc -b && vite build)
npm run lint    # oxlint
npm run smoke   # headless Playwright: visits every route, screenshots to
                 # screenshots/ (gitignored), fails loudly on console errors
npm run smoke:interactive  # fills in real selections on Matchup/Compare/Predict
npm run smoke:mobile       # 390px viewport check
```
