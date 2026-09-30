# Deploying Tracc for free

Total cost: **$0/month**. Backend on Render (free web service), frontend on
Cloudflare Pages (free static hosting), SQLite auto-seed (no database to manage),
n8n skipped (the in-app automation runner already executes all 3 workflows).

> Free tiers sleep when idle — the first visit after ~15 min takes ~60s to
> wake up. Mention this in any demo you give.

## 1. Backend — Render

1. Sign up at [render.com](https://render.com) (GitHub login works).
2. **New → Blueprint** → connect the `tracc` repo → Apply.
   Render reads `render.yaml` and creates the `tracc-backend` web service.
3. When prompted for env vars, fill in:
   - `NVIDIA_API_KEY` → your key from [build.nvidia.com](https://build.nvidia.com/settings/api-keys)
   - `OPENROUTER_API_KEY` → optional backup key (leave blank to skip)
   - (`SECRET_KEY` / `WORKFLOW_API_TOKEN` auto-generate; leave the rest as-is.)
4. Wait for the first build (~5–10 min: pip install + 10k-load seed). The
   service is live when the health check passes.
5. Note your backend URL, e.g. `https://tracc-backend.onrender.com`.
6. Sanity check: open `https://tracc-backend.onrender.com/docs` — Swagger UI loads.

## 2. Frontend — any static host (pick one)

The app is plain static files (`dist/`), no server or routing rules needed.
In all three, set this environment variable (use *your* backend URL):

`VITE_API_BASE=https://tracc-backend.onrender.com/api/v1`

| Host | How | Settings |
|---|---|---|
| **Cloudflare Pages** | Dash → Workers & Pages → Create → Pages → Connect to Git | Root `frontend` · Build `npm run build` · Output `dist` |
| **Netlify** | Add new site → Import from Git | Base `frontend` · Build `npm run build` · Publish `dist` |
| **Vercel** | Add New → Project → Import repo | Root Directory `frontend` (framework auto-detected as Vite) |

Then open the site URL → log in with a demo account from the README → KPIs load.

> **If login says "Backend unreachable":** the backend doesn't know your
> frontend URL yet (browser CORS block). Fix: Render dashboard →
> `tracc-backend` → **Environment** → add `CORS_EXTRA_ORIGINS` =
> your exact frontend origin (e.g. `https://tracc-five.vercel.app`, no
> trailing slash) → **Save** (auto-redeploys). Then **redeploy the frontend
> too if you changed its env**, and retry after ~1 min (cold start).

## 3. Verify the full loop

- Copilot → `hi` → real greeting (proves the NVIDIA key works in production)
- Load board → open a load → SHAP risk renders
- Alerts Center → **Run Now** on a workflow → alert appears (native runner, no n8n needed)

## Notes

- **Data resets on redeploy/restart** — SQLite is ephemeral on Render; every boot reseeds the same synthetic dataset. Perfect for demos, unsuitable for real data (that would need Render Postgres, paid).
- **Quotas follow you** — OpenRouter ~50 req/day and NVIDIA free-tier RPM limits apply in production too; the app degrades to offline heuristics automatically.
- **Custom domain** (optional): Cloudflare Pages → Custom domains; Render → Settings → Custom Domains. Both free with DNS you own.
- **Local Docker Compose stays the dev path** — `docker compose up --build -d` runs the full stack (postgres + n8n) locally; the cloud setup is the demo path.
