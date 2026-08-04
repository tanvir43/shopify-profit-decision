# LS-002A — Production Infrastructure Preparation (Vercel + Neon + Custom Domain)

| Field | Value |
| --- | --- |
| **Phase ID** | LS-002A |
| **App** | ProfitPilot |
| **Date** | 2026-08-04 |
| **Scope** | Infrastructure readiness only — inspect, verify, document |
| **Explicitly out of scope** | Deploy to Vercel; create Neon databases; change DNS; change Partner Dashboard; modify `shopify.app.toml`; modify env values; modify application code / Prisma schema / UI |

---

## 1. Executive Summary

| Metric | Result |
| --- | --- |
| **Overall infrastructure readiness** | **PARTIAL — not deploy-ready yet** |
| **Infrastructure readiness score** | **58 / 100** |
| **Recommended production hostname** | **`app.sniporder.com`** |
| **Estimated deployment effort (next phase)** | **4–8 hours** (plus DNS propagation wait) |

The application **builds successfully** for production (`prisma generate`, `react-router build`, `tsc --noEmit` all pass). The data layer is already **PostgreSQL + Prisma**, which is compatible with Neon. Shopify compliance webhook routes and TOML subscriptions are present.

**Blockers before a safe production deploy:**

1. **No Vercel project configuration** — missing `@vercel/react-router` / `vercelPreset`, no `vercel.json` / `react-router.config.ts`, production start path assumes `react-router-serve` (long-running Node), not Vercel Functions.
2. **`shopify.app.toml` still uses `https://example.com`** placeholders, and OAuth redirect path (`/api/auth`) does not match runtime `authPathPrefix: "/auth"`.
3. **Neon production database does not exist yet** (by design this phase); schema has no `directUrl` for pooled + migrate split.
4. **Custom domain DNS must not be pointed yet** (by design); production `SHOPIFY_APP_URL` is unset for production.

This document prepares the next phase (LS-002B / deploy) so those steps can be executed deliberately.

---

## 2. Vercel Audit

**Verdict: PARTIAL**

| Check | Status | Evidence / notes |
| --- | --- | --- |
| Build command | **PASS** | `package.json` → `"build": "react-router build"`. Local production build succeeded (2026-08-04). |
| Output configuration | **PARTIAL** | Build emits `build/client` + `build/server/index.js`. No Vercel output/adapter wiring. Official Vercel React Router path expects `@vercel/react-router` + `presets: [vercelPreset()]` in `react-router.config.ts` (file absent). |
| Node.js version | **PASS (with note)** | `engines.node`: `>=20.19 <22 \|\| >=22.12`. Local verification used Node **v22.23.1**. No `.nvmrc` / `.node-version` — set Node **22.x** (or 20.19+) explicitly in Vercel project settings. |
| Package manager | **PASS** | npm (`package-lock.json` present). Install with `npm ci` in CI/Vercel. |
| Environment variable usage | **PASS (pattern)** | Runtime reads `SHOPIFY_*`, `SCOPES`, `DATABASE_URL`, optional `SHOP_CUSTOM_DOMAIN`. Values must be set in Vercel Production env (not done this phase). |
| Remix / React Router compatibility | **PARTIAL** | App is **React Router 7** (`react-router` ^7.12, `@react-router/*`). Vercel supports RR7 with the Vercel preset. Template README documents Cloud Run / Fly / Render / manual hosting — **not Vercel-specific**. |
| Server runtime compatibility | **PARTIAL** | Uses `@shopify/shopify-app-react-router/adapters/node` and `entry.server.tsx` with Node streams (`PassThrough`, `createReadableStreamFromReadable`). Compatible with Vercel Node serverless **if** adapter/preset is added; current `"start": "react-router-serve ./build/server/index.js"` is for a persistent Node process (Docker/Fly-style), not Hobby serverless as-is. |
| Dockerfile present | **Info** | `Dockerfile` uses Node 20 Alpine + `docker-start` (`prisma migrate deploy` + serve). Useful alternative host; **not** used by Vercel. |
| Vercel deployment blockers | **YES** | See blockers below. |

### Vercel blockers (must resolve in a later code/config phase — not this phase)

1. Add Vercel React Router integration (`@vercel/react-router`, `react-router.config.ts` with `ssr: true` + `vercelPreset()`).
2. Confirm Shopify Node adapter + custom `entry.server.tsx` work under Vercel Functions (streaming / timeouts).
3. Set Vercel **Build Command** to include Prisma client generation (and prefer migrate deploy as a controlled step), e.g. conceptually: `npx prisma generate && npm run build` (exact command chosen in deploy phase).
4. Do **not** rely on `npm start` / `react-router-serve` on Vercel Hobby.
5. Configure Production environment variables in Vercel (see §4).
6. Hobby plan limits (function duration, concurrency) — validate OAuth + webhook latency after first deploy.

---

## 3. Neon Audit

**Verdict: PARTIAL**

| Check | Status | Evidence / notes |
| --- | --- | --- |
| `DATABASE_URL` usage | **PASS** | `prisma/schema.prisma` datasource `url = env("DATABASE_URL")`; `PrismaClient` via `app/db.server.ts`. |
| SSL requirements | **PASS (ops note)** | Neon requires TLS. Production URL must include `sslmode=require` (Neon console connection strings typically include this). Not encoded in repo — must be present in the connection string at deploy time. |
| Prisma compatibility | **PASS** | Provider `postgresql`; Prisma `^6.16.3` / client generated successfully. Lock file: `prisma/migrations/migration_lock.toml` → `provider = "postgresql"`. |
| Connection pooling | **PARTIAL** | Schema has **only** `url` — **no** `directUrl`. For Vercel serverless + Neon, recommended pattern is: pooled URL (`…-pooler…`) as `DATABASE_URL` for the app, and direct URL as `DIRECT_URL` / `directUrl` for `prisma migrate`. Not configured yet. |
| Migration readiness | **PASS** | Four migrations present under `prisma/migrations/` (Session init → TrackedProduct → CostProfile mode/totalCost → sellingPrice). `npm run setup` = `prisma generate && prisma migrate deploy`. |
| Seed strategy | **N/A / PASS** | No `prisma/seed` script or seed file — nothing to run in production. |
| Production database assumptions | **PARTIAL** | Local `.env.example` documents localhost Postgres. Production Neon project/branch **not created** this phase. App assumes a single Postgres instance reachable via `DATABASE_URL`; session + business tables coexist in one DB. |

### Neon recommendations (for next phase — do not execute now)

1. Create a Neon project (Free) and a dedicated **production** branch/database.
2. Use **pooled** connection string for runtime `DATABASE_URL` (especially on Vercel).
3. Keep **direct** connection string for migrations; add `directUrl = env("DIRECT_URL")` to Prisma datasource in a later change set before migrate-from-pooler issues appear.
4. Optionally append Prisma-friendly query params on pooled URLs (e.g. `pgbouncer=true`, low `connection_limit`) when wiring serverless.
5. Run `prisma migrate deploy` once against production **before** or as part of first successful deploy — never `migrate dev` against production.

---

## 4. Environment Variables Checklist

Do **not** generate secrets. Do **not** invent production values. Status reflects **repository / code** readiness, not live Vercel/Neon dashboards.

| Variable | Required? | Current usage | Missing for production? | Production notes |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | **Yes** | Prisma datasource; all DB access via `PrismaClient` | **Yes** (no Neon prod URL in repo; local only via gitignored `.env`) | Use Neon **pooled** URL with `sslmode=require`. |
| `DIRECT_URL` | **Recommended** (Neon + migrate) | **Not referenced** in schema today | **Yes** (not in `.env.example`) | Add when enabling `directUrl` for migrations against pooler. |
| `SHOPIFY_API_KEY` | **Yes** | `shopify.server.ts`; exposed to client via `app.tsx` loader | **Yes** (must match Partner app client id / TOML `client_id`) | Same app as `client_id` in `shopify.app.toml` (`4dc6ef179915ccd910b31e34ebb3c03a`). |
| `SHOPIFY_API_SECRET` | **Yes** | `shopify.server.ts` (`apiSecretKey`; falls back to `""` if unset — misconfig risk) | **Yes** | From Partner Dashboard / CLI. Never commit. Empty fallback must not ship. |
| `SHOPIFY_APP_URL` | **Yes** | `shopify.server.ts` `appUrl`; Vite host derivation in `vite.config.ts` | **Yes** | Must be final HTTPS origin (recommended `https://app.sniporder.com`) with no trailing path. |
| `SCOPES` | **Yes** | `shopify.server.ts` → `scopes: process.env.SCOPES?.split(",")` | **Yes** (document default) | Align with TOML: `read_products`. |
| `SHOPIFY_API_VERSION` | **No (not an env)** | Hardcoded `ApiVersion.July26` in `shopify.server.ts` / `.graphqlrc.ts` | N/A | Webhook TOML uses `api_version = "2026-01"` — version **divergence** to resolve in a later config pass. |
| `SHOPIFY_APP_HANDLE` | **No (not used in runtime)** | Not read by application code | N/A | Partner/CLI listing concern only; not required for this codebase’s boot. |
| `SESSION_SECRET` | **No (not used)** | Not present in template runtime | N/A | Session crypto uses Shopify app secret via official library; do not invent a unused var unless a future change requires it. |
| `NODE_ENV` | **Yes** (platform) | `db.server.ts` skips global Prisma singleton reuse when `production` | Usually set by Vercel | Ensure `production` on deploy. |
| `PORT` | **No on Vercel** | Vite / local serve | N/A | Used for local/Docker; Vercel assigns port. |
| `HOST` / `FRONTEND_PORT` | **Dev only** | `vite.config.ts` HMR / CLI tunnel workaround | N/A | Do not set for production Vercel. |
| `SHOP_CUSTOM_DOMAIN` | **Optional** | Enables `customShopDomains` when set | Optional | Only if merchants use custom shop domains needing special handling. |

### `.env.example` coverage

Documented today: `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SCOPES`, `SHOPIFY_APP_URL`, `DATABASE_URL`.

**Gaps vs production checklist:** no `DIRECT_URL`, no notes for Vercel/`NODE_ENV`, no warning about empty `SHOPIFY_API_SECRET` fallback.

---

## 5. Production URL Readiness (occurrences only — not changed)

| Location | Value / pattern | Role |
| --- | --- | --- |
| `shopify.app.toml` L5 | `application_url = "https://example.com"` | Production App URL placeholder |
| `shopify.app.toml` L35 | `redirect_urls = [ "https://example.com/api/auth" ]` | OAuth redirect placeholder **and** path mismatch vs `/auth` |
| `vite.config.ts` | Fallback `http://localhost`; HMR host `localhost` | Local Vite / HMR only |
| `.env.example` | `postgresql://…@localhost:5432/profitpilot` (comment example) | Local DB example |
| `README.md` | localhost-based development guidance | Docs only |
| `app/routes/_index/route.tsx` | UI copy `e.g: my-shop-domain.myshopify.com` | Merchant shop domain hint (not app host) |
| `app/routes/auth.login/route.tsx` | `example.myshopify.com` detail text | Login UX placeholder for shop domain |
| `.shopify/project.json` | `campaign-os-dev.myshopify.com` | Dev store linkage (local CLI; gitignored under `.shopify/*`) |
| `docs/approval/AP-001-…` | Documents `example.com` findings | Audit history |

**Not found in app source:** `ngrok`, `trycloudflare`, `vercel.app` production hosts.

**Runtime path note:** `authPathPrefix: "/auth"` (`app/shopify.server.ts`) + route `app/routes/auth.$.tsx` → production redirect URLs should target `/auth` (and typically `/auth/callback` patterns as required by Shopify), **not** `/api/auth`, when URLs are updated in a later phase.

---

## 6. Shopify Configuration Readiness

**Verdict: PARTIAL**

File reviewed: `shopify.app.toml` (**not modified**).

| Item | Status | Finding |
| --- | --- | --- |
| App URL | **FAIL** | `https://example.com` — not production. |
| Redirect URLs | **FAIL** | `https://example.com/api/auth` — placeholder host + **`/api/auth` ≠ `/auth`**. |
| Webhook URLs | **PASS (relative)** | Relative URIs (`/webhooks/...`) — correct for app-specific subscriptions once App URL is real. |
| Scopes | **PASS** | `read_products` — matches MVP product reads / Resource Picker. |
| Embedded | **PASS** | `embedded = true`. |
| API version (webhooks TOML) | **PARTIAL** | `api_version = "2026-01"` vs runtime/codegen `ApiVersion.July26` (2026-07). |
| Compliance webhooks | **PASS** | Declared: `customers/data_request`, `customers/redact`, `shop/redact` with handlers under `app/routes/webhooks.*.tsx`. |
| App lifecycle webhooks | **PASS** | `app/uninstalled`, `app/scopes_update` declared + handlers present. |
| Build flags | **Info** | `automatically_update_urls_on_dev = true` — fine for dev; production URLs must be set deliberately before/at deploy (`include_config_on_deploy = true`). |
| Distribution | **PASS (code)** | `AppDistribution.AppStore` in `shopify.server.ts`. |

**Section note:** Compliance webhook **code** is present (improvement vs older AP-001 narrative). Remaining Shopify infra blockers are **production URLs** and **redirect path alignment**.

---

## 7. Prisma Production Readiness

**Verdict: PASS (with operational risks)**

| Topic | Finding |
| --- | --- |
| Configuration | PostgreSQL via `DATABASE_URL`; generator `prisma-client-js`. |
| Models | `Session` (Shopify session storage), `CostProfile` / `CostItem`, `TrackedProduct`. |
| Migration strategy | Forward-only SQL migrations in repo; production should use `prisma migrate deploy` only. |
| Seed strategy | None — no seed required. |
| Client lifecycle | Dev: global singleton; production: `new PrismaClient()` per module instance — on serverless, prefer one client per isolate + pooled Neon URL to avoid connection exhaustion. |
| Binary / generate | `prisma generate` succeeded locally; Vercel build must run generate (Prisma is in `dependencies`, which helps). Consider documenting `binaryTargets` only if Vercel generate fails for platform. |

### Potential production risks

1. Running migrations through a **pooled** Neon URL without `directUrl` can fail or behave oddly.
2. Serverless connection storms if using **non-pooled** Neon URL on Vercel.
3. `SHOPIFY_API_SECRET || ""` allows boot with invalid auth configuration.
4. No automated migrate step wired to Vercel yet — empty DB → runtime errors (`Session` / business tables missing).
5. Lint currently reports **2 errors** in product UI/simulation files; they did **not** fail `npm run build` / typecheck, but may fail CI if lint is gated later.

---

## 8. Custom Domain Plan

**Current owned domain:** `sniporder.com`  
**Constraint this phase:** Do **not** modify DNS; do **not** point the domain yet.  
**Future:** Existing website on apex will be replaced later.

### Comparison

| Option | Pros | Cons |
| --- | --- | --- |
| `sniporder.com` (apex) | Short; brand domain | Conflicts with planned marketing/website replacement; awkward to host both site + embedded app origin; Shopify app URL churn if marketing needs apex |
| `app.sniporder.com` | Clear “application” host; apex free for site; common SaaS/Shopify pattern; stable OAuth/webhook origin | Slightly longer hostname |
| `profitpilot.sniporder.com` | Product-branded; allows multiple products under sniporder.com | Longer; couples DNS to product name; less conventional than `app.` |

### Recommendation

**Use `app.sniporder.com` as the Shopify application origin.**

**Why:** Keeps `sniporder.com` available for the public website replacement; matches standard app-subdomain practice; keeps Partner Dashboard App URL / OAuth redirects / webhooks on a stable HTTPS origin independent of marketing page redesigns. Prefer `profitpilot.sniporder.com` only if you expect multiple distinct apps under the same apex and want product-named hosts.

**DNS (next phase only):** CNAME `app` → Vercel target after the Vercel project exists; do not cut over until env vars + Shopify URLs are ready.

---

## 9. Build Verification (executed locally — not deployed)

| Step | Result | Notes |
| --- | --- | --- |
| Node / npm | **PASS** | Node `v22.23.1`, npm `10.9.8` |
| Dependencies | **PASS** | `node_modules` present; lockfile `package-lock.json` |
| `npx prisma generate` | **PASS** | Prisma Client generated |
| `npm run build` | **PASS** | Client + SSR server bundles emitted under `build/` |
| `npm run typecheck` | **PASS** | `react-router typegen && tsc --noEmit` exit 0 |
| `npm run lint` | **PARTIAL** | 2 ESLint **errors** (a11y in `InlineSellingPriceEditor.tsx`; unused `_fields` in `simulateProjectedOutcome.ts`). Not a Vite build blocker today. |
| Known production blockers | **Yes** | Vercel adapter/config absent; Shopify `example.com` URLs; Neon prod DB absent; domain not pointed (intentional). |

---

## 10. Deployment Checklist (documentation only — do not execute)

Ordered for a safe first production cutover. **Stop and verify** after each major section.

### A. Prerequisites (may require a small prep PR before deploy)

1. [ ] Add Vercel React Router support (`@vercel/react-router`, `react-router.config.ts` with `vercelPreset`, confirm Node adapter + `entry.server.tsx`).
2. [ ] Decide Prisma Neon pooling approach (`DATABASE_URL` pooled + `DIRECT_URL` / `directUrl` for migrations).
3. [ ] Confirm production hostname: **`https://app.sniporder.com`**.
4. [ ] Ensure lint/CI policy is accepted (fix existing lint errors or gate later).

### B. Neon

5. [ ] Create Neon project (Free) and production database/branch.
6. [ ] Copy pooled + direct connection strings (with SSL).
7. [ ] Run `prisma migrate deploy` against production using the **direct** URL (from a trusted machine or one-off job).
8. [ ] Verify tables exist (`Session`, `CostProfile`, `CostItem`, `TrackedProduct`).

### C. Vercel project

9. [ ] Create Vercel project (Hobby); connect Git repository.
10. [ ] Set Node.js version to **22.x** (or compatible `engines` range).
11. [ ] Set install/build commands (`npm ci`; build includes `prisma generate`).
12. [ ] Configure **Production** env vars: `DATABASE_URL`, `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`, `SCOPES`, `NODE_ENV=production`, and `DIRECT_URL` if adopted.
13. [ ] Deploy to a Vercel URL first (preview/production `.vercel.app`) **before** custom domain cutover.
14. [ ] Smoke-test health of SSR response on the Vercel URL.

### D. Custom domain (after app responds on Vercel)

15. [ ] Add `app.sniporder.com` in Vercel domains.
16. [ ] Create DNS CNAME (or as Vercel instructs) — **only in deploy phase**.
17. [ ] Wait for HTTPS certificate + propagation.
18. [ ] Set `SHOPIFY_APP_URL=https://app.sniporder.com` and redeploy if needed.

### E. Shopify URLs & config (Partner Dashboard / `shopify app deploy` — not this phase)

19. [ ] Update `shopify.app.toml` `application_url` to `https://app.sniporder.com`.
20. [ ] Update `redirect_urls` to match **`/auth`** (not `/api/auth`), including all callback URLs Shopify requires.
21. [ ] Align webhook `api_version` with runtime API version (or consciously document the split).
22. [ ] Deploy app config (`shopify app deploy`) / update Partner Dashboard URLs.
23. [ ] Confirm compliance + app webhooks show as subscribed.

### F. Post-deploy verification

24. [ ] OAuth install on a dev/production test store.
25. [ ] Embedded app loads in Admin (App Bridge / session).
26. [ ] Webhook delivery smoke test (`app/uninstalled` on a throwaway install; compliance handlers reachable).
27. [ ] Create a Tracked Product + Cost Profile against production DB.
28. [ ] Confirm no Prisma connection exhaustion under a short burst of Admin navigation.

---

## 11. Score Breakdown

| Area | Weight | Score | Weighted |
| --- | --- | --- | --- |
| Vercel compatibility / config | 20 | 8/20 | 8 |
| Neon / DB readiness | 15 | 10/15 | 10 |
| Environment variable readiness | 10 | 6/10 | 6 |
| Production URL hygiene | 10 | 3/10 | 3 |
| Shopify config readiness | 15 | 9/15 | 9 |
| Prisma / migrations | 10 | 9/10 | 9 |
| Build / typecheck | 15 | 13/15 | 13 |
| Domain plan clarity | 5 | 5/5 | 5 |
| **Total** | **100** | | **58** |

---

## 12. Production Blockers Summary

| ID | Blocker | Severity | Phase to clear |
| --- | --- | --- | --- |
| B-01 | No Vercel React Router preset / project wiring; start script is long-running Node | **Critical** | Prep PR + LS deploy |
| B-02 | `shopify.app.toml` App URL / redirects still `example.com` | **Critical** | After host exists |
| B-03 | OAuth redirect path `/api/auth` vs runtime `/auth` | **Critical** | Same TOML update |
| B-04 | Neon production database not created | **Critical** | Deploy phase |
| B-05 | No `directUrl` / pooling split documented in schema | **High** | Before serverless migrate |
| B-06 | Custom domain not pointed (intentional) | **Expected** | Deploy phase |
| B-07 | Webhook API version vs `ApiVersion.July26` mismatch | **Medium** | Config alignment |
| B-08 | ESLint errors (2) if CI enforces lint | **Low–Medium** | Quality pass |

---

## 13. Estimated Deployment Effort

| Workstream | Estimate |
| --- | --- |
| Vercel adapter / config prep (code) | 1–3 hours |
| Neon create + migrate deploy | 30–60 minutes |
| Vercel project + env + first deploy | 1–2 hours |
| DNS `app.sniporder.com` + TLS | 30–90 minutes (propagation-dependent) |
| Shopify URL / TOML / webhook verify | 1–2 hours |
| End-to-end OAuth + embedded + data smoke | 1 hour |
| **Total** | **~4–8 hours** focused work |

---

## 14. Overall Readiness Statement

ProfitPilot is **build-ready** and **database-shape-ready** for Neon Postgres, with Shopify embedded/auth/webhook **code** largely in place. It is **not yet infrastructure-deploy-ready** on the chosen stack (Vercel Hobby + Neon Free + `sniporder.com`) because Vercel integration is unconfigured, production secrets/URLs are unset, Neon production does not exist, and Shopify TOML still points at `example.com`.

**Recommended next phase:** implement Vercel React Router wiring (minimal code change), then execute the deployment checklist above with hostname **`https://app.sniporder.com`**, without rushing DNS or Partner Dashboard URL switches until the Vercel deployment responds healthily.

---

*End of LS-002A. No deployment, DNS, Partner Dashboard, TOML, env, or application code changes were made in this phase.*
