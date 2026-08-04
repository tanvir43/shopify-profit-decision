# AP-001 — Shopify App Approval Readiness Audit

| Field | Value |
| --- | --- |
| **Audit ID** | AP-001 |
| **App** | ProfitPilot |
| **Audit date** | 2026-08-04 |
| **Auditor role** | Shopify App Review engineer (simulated) |
| **Scope** | Inspection only — no code, config, or documentation changes beyond this report |
| **Question answered** | Is this application ready to be submitted to the Shopify App Store? |

---

## 1. Executive Summary

| Metric | Score |
| --- | --- |
| **Overall Approval Readiness** | **38%** |
| **Overall MVP Completion** | **88%** |
| **Launch Recommendation** | **❌ Not Ready** |

**Brief explanation**

The product MVP for cost entry and live profit simulation is largely built and coherent. Shopify platform foundations (embedded app, OAuth via official SDK, offline sessions, `app/uninstalled`, shop-scoped data access) are in good shape for a React Router template app.

However, the app is **not submission-ready**. Mandatory App Store compliance webhooks are absent, listing/legal assets are missing, production URLs are still placeholders (`example.com`), the default app home is an empty Dashboard, and uninstall does not erase merchant business data. These are realistic automated-check and reviewer rejection causes, independent of MVP feature quality.

---

## 2. Project Overview

| Topic | Finding |
| --- | --- |
| **App purpose** | Embedded Shopify admin app that helps merchants track product costs, set selling prices, and simulate pricing/promotion strategies against projected profit and margin. |
| **Target merchants** | Shopify merchants who need simple product-level cost tracking and “what-if” pricing/discount decisions (not full accounting). |
| **Current MVP scope** | Tracked Products workspace → cost onboarding (Quick Start / Detailed) → selling price → Decision Workspace with live strategy simulation and compatibility warnings. Pricing/Discounts/Settings modules are shell-only and nav-disabled. |
| **Main merchant workflow** | Add products via Resource Picker → Open → choose Quick Start or Detailed Setup → enter cost → set selling price (inline or page) → adjust Decision Strategies → observe Profit / Loss. |
| **Core business value** | Lets merchants see whether a price or promo still leaves profit, using their own cost facts, without leaving Admin. |
| **Primary implemented features** | Tracked Products; Quick Start; Detailed Cost Breakdown; Selling Price (page + inline); Decision Workspace; strategy catalog + live simulation; sticky projected outcome; compatibility warnings; cost breakdown modal. |

**Evidence:** `docs/product-roadmap.md` (PP-0010 through PP-0015.4.5 completed); `docs/README_ARCHITECTURE.md`; `shopify.app.toml` (`name = "ProfitPilot"`).

---

## 3. Shopify Technical Requirements

| Requirement | Result | Evidence / notes |
| --- | --- | --- |
| **Authentication** | **PASS** | `authenticate.admin(request)` on app layout and feature routes (`app/routes/app.tsx`, product routes). OAuth via `@shopify/shopify-app-react-router`. |
| **Embedded App** | **PASS** | `embedded = true` in `shopify.app.toml`; `AppProvider embedded` in `app/routes/app.tsx`. |
| **OAuth** | **PARTIAL** | Official `shopifyApp` + `authPathPrefix: "/auth"` (`app/shopify.server.ts`) and `app/routes/auth.$.tsx`. **But** `shopify.app.toml` redirect URLs point at `https://example.com/api/auth` (placeholder host **and** `/api/auth` path mismatch vs `/auth`). |
| **Offline Session** | **PASS** | Prisma `Session` model with `isOnline` default `false`; `PrismaSessionStorage`; `expiringOfflineAccessTokens: true` (`prisma/schema.prisma`, `app/shopify.server.ts`). |
| **Online Session** | **PARTIAL** | Schema supports online fields (`userId`, `email`, etc.), but app usage is offline-token oriented; no explicit online-session merchant UX. Acceptable for many admin apps; not a functional gap for this MVP. |
| **Session handling** | **PASS** | Prisma session storage; uninstall deletes sessions for shop (`app/routes/webhooks.app.uninstalled.tsx`). |
| **App Bridge** | **PASS** | `@shopify/app-bridge-react`; App Bridge web components (`s-app-nav`, `s-page`, Resource Picker via `shopify.resourcePicker` in `useAddTrackedProducts.ts`). |
| **Webhook registration** | **PARTIAL** | Declarative subscriptions in `shopify.app.toml` for `app/uninstalled` and `app/scopes_update` only. `registerWebhooks` exported but no custom `afterAuth` visible. Missing **mandatory compliance** topics. |
| **APP_UNINSTALLED webhook** | **PARTIAL** | Handler exists and authenticates webhook; deletes `Session` rows only. Does **not** delete `CostProfile` / `CostItem` / `TrackedProduct`. Full shop data erasure is expected via `shop/redact` (also missing). |
| **Required scopes** | **PASS** | `read_products` only (`shopify.app.toml`, `.env.example`) — appropriate for current GraphQL product reads + Resource Picker. |
| **Shopify API version** | **PARTIAL** | Runtime/codegen: `ApiVersion.July26` (`app/shopify.server.ts`, `.graphqlrc.ts`). Webhooks TOML: `api_version = "2026-01"`. Versions diverge. |
| **App URL** | **FAIL** | `application_url = "https://example.com"` — not a production URL. |
| **Redirect URLs** | **FAIL** | `redirect_urls = [ "https://example.com/api/auth" ]` — placeholder + path inconsistency with `authPathPrefix: "/auth"`. |
| **Embedded navigation** | **PARTIAL** | `s-app-nav` with Products only (`app/lib/navigation.ts`, `AppNavigation.tsx`). Works for MVP, but default `/app` home is empty Dashboard (see Navigation / Reviewer sections). |

**Section verdict:** Core embedded auth works; **production config + mandatory compliance webhooks block submission**.

---

## 4. Navigation Audit

| Area | Finding | Evidence |
| --- | --- | --- |
| **Sidebar** | Only **Products** enabled. | `ALL_NAV_ITEMS` / `NAV_ITEMS` in `app/lib/navigation.ts` |
| **Routes present** | `/app`, `/app/products`, product detail + quick-start / detailed-setup / selling-price, legacy cost-profile, `/app/pricing`, `/app/discounts`, `/app/settings`, auth, webhooks. | `app/routes/*` |
| **Hidden but reachable** | Dashboard, Pricing, Discounts, Settings remain routable though `enabled: false`. Comment in navigation intentionally keeps them reachable by URL. | `app/lib/navigation.ts` lines 5–14 |
| **Dead / empty pages** | Dashboard, Pricing, Discounts, Settings render title-only `PageLayout` with **no content**. | `DashboardPage.tsx`, `PricingPage.tsx`, `DiscountsPage.tsx`, `SettingsPage.tsx` |
| **Broken links** | No obvious broken hrefs in primary Products flow. Legacy catalog `ProductRow` still links to cost-profile. | `ProductRow.tsx` → `costProfileHref` |
| **Placeholder pages** | Empty shell pages above; landing page still has template “Product feature” bullets. | `app/routes/_index/route.tsx` |
| **Coming Soon** | No “Coming Soon” copy found in app UI code. Empty shells are worse: they look unfinished without explanation. | Grep across `app/` |
| **Non-MVP accessible** | `/app` (blank), `/app/pricing`, `/app/discounts`, `/app/settings`, `/app/products/:productId/cost-profile` (legacy read-only UX with inert CTAs). | Routes + `CostProfilePage.tsx` |

**Risk:** Reviewer who bookmarks `/app` or opens App Home lands on a blank Dashboard while sidebar only lists Products.

---

## 5. Merchant Workflow Audit

Intended path:

**Products → Open Product → Quick Start / Detailed Setup → Product Cost → Selling Price → Decision Workspace → Strategies → Profit / Loss**

| Step | Status | Notes |
| --- | --- | --- |
| Tracked Products list + Add | **OK** | Resource Picker + POST action; empty state present. |
| Open product | **OK** | Opens onboarding or Decision Workspace based on cost profile mode. |
| Quick Start / Detailed Setup | **OK** | Choice cards; both save and redirect to product overview. |
| Product Cost | **OK** | Persisted as `totalCost` (Quick Start) or summed items (Detailed). |
| Selling Price | **OK** | Dedicated page + inline editor on Decision Workspace; validation present. |
| Decision Workspace | **OK** | Summary, sticky outcome, strategies, costing section. |
| Strategies + Profit/Loss | **OK** | Client-side simulation; clearly framed as simulation. |
| Dead ends | **Minor** | No UI to untrack products (`untrackProduct` exists in service/repo only). Unavailable products disable Open (reasonable). |
| Broken flow | **None found** in primary path | Loaders enforce shop + tracked product ownership. |
| Unnecessary navigation | **Minor** | App Home blank; selling-price page still exists alongside inline edit (acceptable). |
| Confusing UX | **Medium** | Strategies reset on refresh (ephemeral by design — not explained strongly outside workspace copy). Legacy cost-profile route can create/ensure profiles outside tracked flow. |

**Verdict:** Primary MVP journey is **usable end-to-end**. Not a workflow-blocker for approval by itself; first-load / empty shells are.

---

## 6. MVP Feature Audit

| Feature | Result | Why |
| --- | --- | --- |
| **Tracked Products** | **PASS** | Model, list, Resource Picker, shop-scoped track action (`TrackedProduct`, `app.products.tsx`). |
| **Quick Start** | **PASS** | Route + service + validation + redirect to workspace. |
| **Detailed Cost Breakdown** | **PASS** | Detailed setup page/route; modal reuse for edit; saves items + mode `DETAILED`. |
| **Selling Price** | **PASS** | Persist on `CostProfile.sellingPrice`; page + inline editor. |
| **Decision Workspace** | **PASS** | `ProductDecisionDashboardPage` when profile mode set. |
| **Decision Strategies** | **PASS** | Catalog + controls + multi-strategy simulation (`strategyCatalog.ts`, `StrategyControls.tsx`). |
| **Warnings** | **PASS** | Compatibility warnings after simulation (`CompatibilityWarnings`, `strategyCompatibility.ts`). |
| **Live Simulation** | **PASS** | `simulateProjectedOutcome` on every change; client-side. |
| **Sticky Workspace Header** | **PASS** | `StickyWorkspaceHeader` component wired into dashboard. |
| **Inline Selling Price Editing** | **PASS** | `InlineSellingPriceEditor` on Product Summary. |
| **Cost Breakdown Modal** | **PASS** | `CostBreakdownModal` + commandFor show. |
| **Strategy Management** | **PARTIAL** | Add/remove from library + configure fields: **yes**. Persist strategies / apply to Shopify discounts: **no** (intentional MVP — simulation only). |
| **Compatibility Warnings** | **PASS** | Advisory only; does not block simulation (per design). |

**MVP feature verdict:** Core scoped MVP ≈ **complete**. Remaining gaps are intentional deferrals (apply discounts, pricing module, persistence of strategies) rather than missing checklist items from the current roadmap.

---

## 7. Data Model Audit

**Schema:** `prisma/schema.prisma` — PostgreSQL.

| Model / area | Assessment |
| --- | --- |
| **Session** | Required platform table; includes refresh-token fields. Appropriate. |
| **CostProfile** | 1:1 per `(shop, productId)`; currency, mode, totalCost, sellingPrice, notes. Sound for MVP. |
| **CostItem** | Child aggregate with unit/category/active/sortOrder/system flags. Cascades on profile delete. |
| **TrackedProduct** | Reference-only `(shopId, shopifyProductId)`; no catalog cache. Aligns with architecture. |
| **Relationships** | CostItem → CostProfile. No FK between TrackedProduct and CostProfile (joined in app by shop + Shopify product id). Intentional; risk of orphan cost profiles if products untracked. |
| **Unused models** | None unused; `Session` is platform. Domain models are used. |
| **Unused columns / enums** | `CostUnit.PERCENTAGE` and some `CostCategory` values are schema-ready but Detailed Setup appears FIXED-line oriented. `notes` on CostProfile lightly used. Not blockers. |
| **Duplicated data** | Minimal — Shopify owns product title/image; enrichment at runtime. Good. |
| **Inconsistencies** | `shop` vs `shopId` naming across CostProfile vs TrackedProduct. `getCostProfileByTrackedProductId` repository method name takes `productId` (Shopify id), not tracked cuid — naming drift. |
| **Maintenance risks** | Full item replace (`replaceItems` / nested deleteMany+create) — documented as ARCH-001. Uninstall/redact cleanup incomplete. Legacy cost-profile `ensureForProduct` can create empty DETAILED profiles outside onboarding. |

**No modifications made** (audit only).

---

## 8. Security Audit

| Area | Result | Evidence |
| --- | --- | --- |
| **Authentication** | Strong | All `/app/*` loaders/actions call `authenticate.admin`. Webhooks use `authenticate.webhook`. |
| **Authorization / shop isolation** | Strong | Queries filter by `session.shop` / `shopId` (tracked product + cost profile repos). |
| **Loader / action protection** | Strong for app routes | Nested under authenticated `app.tsx`; feature routes re-authenticate. |
| **Server-side validation** | Present | Quick Start / selling price / detailed amounts validated in services/validators. Product IDs JSON-parsed with type checks. |
| **Unsafe queries** | None obvious | Prisma parameterized; no raw SQL found in app modules. GraphQL via Admin client. |
| **Secrets** | Acceptable pattern | `.env` gitignored; `.env.example` has empty placeholders. `SHOPIFY_API_SECRET` falls back to `""` if unset (misconfig risk in prod). |
| **Environment variables** | Documented | `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SCOPES`, `SHOPIFY_APP_URL`, `DATABASE_URL`. |
| **Reviewer flags** | **High** | Missing compliance webhooks; incomplete uninstall data deletion; placeholder production URLs; `console.log` of shop/topic on webhooks (low severity). Landing page not claiming false capabilities beyond generic template text. |

**Note:** App does not appear to store customer PII in business tables (cost/product refs only). Compliance webhooks are still **mandatory** for App Store apps regardless.

---

## 9. UI / UX Audit

| Area | Assessment |
| --- | --- |
| **Loading states** | Good for tracked list (`Suspense` + skeleton rows). |
| **Empty states** | Good for tracked products. Legacy cost-profile empty state has inert “Add First Cost” button. |
| **Error states** | Banners on track failure, route ErrorBoundaries, enrichment warning banner. |
| **Success states** | Mostly implicit via redirect/revalidate; limited explicit success toasts. |
| **Validation** | Client + server for money fields; field errors shown. |
| **Responsive** | Strategy grid uses auto-fit columns; Polaris web components. Not exhaustively verified in browsers for this audit. |
| **Accessibility** | Some `accessibilityLabel`s; keyboard support on inline selling price (Enter/Escape per design). Polaris components help; not a full a11y audit. |
| **Consistency** | Strong within Decision Workspace; weak across shell pages (blank titles). |
| **Visual hierarchy** | Workspace sections ordered clearly (Summary → sticky outcome → strategies → costing). |
| **Merchant friendliness** | Onboarding copy is clear; simulation disclaimer present under strategies. |
| **Weak areas** | Blank App Home; empty future modules; no remove-from-tracked UI; legacy cost-profile dead CTAs (“Manage Cost Items”, “Add First Cost” with no handlers); template marketing landing page. |

---

## 10. Performance Audit

| Risk | Severity | Evidence |
| --- | --- | --- |
| **Batched product enrichment** | Mitigated | `fetchProductsByIds` uses GraphQL `nodes(ids:)` once per list load. |
| **N+1** | Low for current flows | Workspace avoids per-row Shopify calls. |
| **Heavy GraphQL** | Low–Medium | Entire tracked set enriched in one query — fine for small lists; may need chunking if merchants track hundreds (Shopify `nodes` limits). |
| **Deferred workspace promise** | Good | Loader returns Promise for enrichment + Suspense. |
| **Unnecessary revalidation** | Low | Revalidate after track / selling-price save — appropriate. |
| **Large React trees** | Medium (UX, not server) | `StrategyControls.tsx` ~632 lines; many controlled inputs — acceptable for MVP; client simulation is cheap vs network. |
| **Currency resolution** | Extra GraphQL on Quick Start / Detailed / Selling Price loaders | `resolveShopCurrency` — small overhead. |
| **Full CostItem replace** | Write amplification | Documented ARCH-001; fine at small item counts. |

No performance issue identified that would alone fail App Review.

---

## 11. Production Readiness

| Check | Status | Notes |
| --- | --- | --- |
| **Environment variables** | Ready pattern | Need real prod values; example file complete enough. |
| **Production configuration** | **Not ready** | `application_url` / `redirect_urls` are `example.com`. |
| **Database** | Schema + migrations present | PostgreSQL; `npm run setup` = `prisma generate && prisma migrate deploy`. |
| **Migration readiness** | OK for deploy path | Four migrations under `prisma/migrations/`. |
| **Webhook readiness** | Incomplete | Uninstall + scopes_update only; **no compliance webhooks**; uninstall incomplete data purge. |
| **Logging** | Minimal | `console.log` / `console.error` only — no structured prod logging/monitoring. |
| **Error handling** | Adequate for MVP | Route boundaries + user-facing banners. |
| **Deployment** | Dockerfile present | `docker-start` runs migrate deploy then serve. Alpine + openssl for Prisma. |
| **Tests** | **Missing** | No `*.test.*` / `*.spec.*` found in repo. Not always an App Store reject reason, but increases regression risk. |
| **README accuracy** | Stale vs product | Root `README.md` still Shopify template language (mentions SQLite); schema is PostgreSQL. |

---

## 12. Shopify Review Readiness

| Requirement | Status | Notes |
| --- | --- | --- |
| **Privacy Policy** | **MISSING** | No privacy route/page/asset; required for App Store listing. |
| **Terms of Service** | **MISSING** | Not found. |
| **Support Email** | **MISSING** | Not in repo / TOML. |
| **Support URL** | **MISSING** | Not found. |
| **App Listing copy** | **MISSING** | Partner Dashboard concern; no listing assets in repo. |
| **App Description** | **MISSING** | Landing page still template bullets. |
| **App Icon** | **MISSING / default** | Only `public/favicon.ico` found; no branded listing icon set. |
| **Screenshots** | **MISSING** | None in repo. |
| **Demo Data / test shop guidance** | **MISSING** | No reviewer demo script in repo. |
| **Billing** | **N/A / not implemented** | No Billing API usage found. Free apps OK if listing matches; ensure pricing claims are accurate. |
| **Required URLs** | **FAIL** | Production app URL + OAuth redirects + privacy/support URLs unset. |
| **Mandatory compliance webhooks** | **FAIL** | `customers/data_request`, `customers/redact`, `shop/redact` absent from TOML and routes. |
| **Protected customer data** | Likely N/A | App uses `read_products` only; still must implement compliance endpoints. |

---

## 13. Reviewer Experience Audit

Assume a Shopify reviewer installs ProfitPilot and opens it from Admin.

| Moment | Likely experience |
| --- | --- |
| **First impression** | App Home → `/app` → **empty “Dashboard” page**. Sidebar shows only Products. Confusing and unfinished. |
| **Onboarding** | After navigating to Products: clear empty state (“No products added yet”) + Add Products. Good once discovered. |
| **Clarity** | Onboarding choice and Decision Workspace copy are merchant-friendly. Simulation language is present. |
| **Broken UX** | Blank shell routes if URL guessed; legacy cost-profile inert buttons; no untrack. |
| **Confusing interactions** | Strategy state lost on reload; profit depends on cost + selling price — if selling price unset, outcome null (editor exists). |
| **Missing instructions** | No in-app “how to get started” on App Home; no help/settings. |
| **Frustration drivers** | Blank home; missing privacy/support; if automated checks run first, compliance webhooks fail before human review. |

---

## 14. Launch Blockers

Issues that would **realistically block** Shopify approval or prevent a responsible submission. Separated from technical debt.

| ID | Issue | Severity | Reason | Evidence | Recommendation | Est. effort |
| --- | --- | --- | --- | --- | --- | --- |
| LB-01 | Mandatory compliance webhooks missing | **Critical** | App Store requires `customers/data_request`, `customers/redact`, `shop/redact`; automated preliminary checks fail without them. | No compliance topics in `shopify.app.toml`; no compliance routes under `app/routes/`. | Add TOML `compliance_topics` subscription + authenticated handlers returning 401/200 correctly; implement shop data deletion on `shop/redact`. | 1–2 days |
| LB-02 | Privacy Policy (+ listing link) missing | **Critical** | Privacy requirements for App Store listing. | No privacy page/asset; grep finds no privacy/terms content. | Publish Privacy Policy URL; link from Partner Dashboard listing. | 0.5–1 day (+ legal) |
| LB-03 | Production App URL / OAuth redirects still placeholders | **Critical** | App cannot be installed/reviewed against `example.com`; redirect path also mismatches `/auth`. | `shopify.app.toml` `application_url` / `redirect_urls`. | Deploy HTTPS host; set `application_url` and redirect URLs to `/auth` (or align path deliberately). | 0.5 day (+ hosting) |
| LB-04 | App Home is blank Dashboard | **High** | Reviewers judge completeness from first screen. | `app._index.tsx` → empty `DashboardPage`; nav disables Dashboard but route remains default home. | Redirect `/app` → `/app/products` or replace home with guided onboarding. | 2–4 hours |
| LB-05 | Uninstall / redact does not purge merchant data | **High** | `shop/redact` must erase shop data; uninstall currently only deletes sessions. Orphan CostProfiles/TrackedProducts remain. | `webhooks.app.uninstalled.tsx` deletes `Session` only. | On uninstall and/or `shop/redact`, delete CostProfile (cascade items) + TrackedProduct for shop. | 0.5–1 day |
| LB-06 | Support contact / Support URL missing | **High** | Listing requires merchant support channel. | Not present in repo or config. | Add support email + URL; surface in listing (and ideally Settings). | 2–4 hours |
| LB-07 | Empty / non-MVP routes still public inside app | **Medium** | Reviewers may navigate to `/app/pricing` etc. and see unfinished surfaces. | Empty page components; routes authenticated but contentless. | Remove routes or show intentional “Not available” / redirect to Products for MVP. | 2–4 hours |
| LB-08 | Template placeholder marketing content on `/` | **Medium** | Looks unprofessional if app URL is visited; listing quality signal. | `app/routes/_index/route.tsx` “Product feature” bullets. | Replace with real ProfitPilot value props or minimal install gate. | 2–4 hours |

---

## 15. Potential Rejection Risks

| Risk category | Risk | Likelihood |
| --- | --- | --- |
| **Security / compliance** | Missing mandatory webhooks; incomplete data deletion | **Very high** (often automated fail) |
| **Legal pages** | No Privacy Policy / Terms | **Very high** |
| **UX** | Blank App Home; empty modules | **High** |
| **Broken / incomplete flows** | Legacy cost-profile dead CTAs if discovered | **Medium** |
| **Incomplete onboarding** | No home guidance | **Medium** |
| **Placeholder content** | Landing template copy; `example.com` config | **High** |
| **Functionality claims** | Simulation does not create Shopify discounts — OK if listing does not claim otherwise | **Medium** if listing overpromises |
| **Auth misconfig** | `/api/auth` vs `/auth` redirect mismatch | **High** if not fixed before prod install tests |

---

## 16. Technical Debt

Acceptable for MVP / post-launch — **not** listed as launch blockers.

| Item | Notes |
| --- | --- |
| ARCH-001 full CostItem replace | Documented in `docs/architecture-backlog.md`. |
| Strategy inputs ephemeral | By design through PP-0015.x; persistence later. |
| Pricing / Discounts / Settings modules | Shell stubs for future roadmap. |
| Legacy `ProductList` / `fetchProductsPage` | Catalog list path appears superseded by Tracked Products; still in codebase. |
| Legacy `/cost-profile` route | Early PP-0007/0008 surface; parallel to tracked-product flow. |
| `shop` vs `shopId` naming | Consistency cleanup. |
| Repository method naming drift | `getCostProfileByTrackedProductId` vs Shopify product id. |
| API version TOML vs runtime mismatch | Align `2026-01` vs July26. |
| No automated tests | Post-launch quality investment. |
| Minimal structured logging / observability | Post-launch. |
| `PERCENTAGE` cost unit unused in builders | Schema ahead of UI. |
| Root README still template-oriented | Docs hygiene. |
| `console.log` in webhook handlers | Replace with structured logger later. |

---

## 17. Placeholder / Debug Audit

Search covered app source, config, and docs (excluding `node_modules` / lockfile noise).

### Application / config issues (actionable)

| Occurrence | File | Notes |
| --- | --- | --- |
| `application_url = "https://example.com"` | `shopify.app.toml` | Production placeholder |
| `redirect_urls = [ "https://example.com/api/auth" ]` | `shopify.app.toml` | Placeholder + path mismatch |
| Template “Product feature” × 3 | `app/routes/_index/route.tsx` | Placeholder marketing copy |
| Empty Dashboard page | `app/modules/dashboard/DashboardPage.tsx` | Title only |
| Empty Pricing page | `app/modules/pricing/PricingPage.tsx` | Title only |
| Empty Discounts page | `app/modules/discounts/DiscountsPage.tsx` | Title only |
| Empty Settings page | `app/modules/settings/SettingsPage.tsx` | Title only |
| “Manage Cost Items” button with no action | `app/modules/cost-profiles/CostProfilePage.tsx` | Dead CTA |
| “Add First Cost” button with no action | `app/modules/cost-profiles/components/CostItemsEmptyState.tsx` | Dead CTA |
| `console.log` webhook topic/shop | `app/routes/webhooks.app.uninstalled.tsx` | Debug-style logging |
| `console.log` webhook topic/shop | `app/routes/webhooks.app.scopes_update.tsx` | Debug-style logging |
| `console.error` on selling price failure | `app/routes/app.products_.$trackedProductId_.selling-price.tsx` | Acceptable error log |
| `console.error` in SSR | `app/entry.server.tsx` | Template error logging |

### Non-blocking / intentional wording

| Occurrence | File | Notes |
| --- | --- | --- |
| Skeleton “Product title placeholder” | `TrackedProductRowSkeleton.tsx` | Loading UI, not merchant placeholder content |
| Comment “no placeholder text” | `StrategyControls.tsx` | Input UX note |
| “Temporary percentage-off promotion” | `strategyCatalog.ts` | Strategy description copy |
| Docs mentioning placeholders / TODOs process | `docs/product-roadmap.md`, `docs/README_ARCHITECTURE.md` | Historical / process docs |
| No `TODO` / `FIXME` markers in `app/` source | — | Clean relative to many codebases |

### Not found

- “Coming Soon” UI strings in `app/`
- Dummy/fixture merchant data seeders
- Debug-only routes beyond empty shells
- Privacy/Terms pages

---

## 18. Evidence Index

| Area | Primary evidence |
| --- | --- |
| App config | `shopify.app.toml`, `shopify.web.toml`, `package.json` |
| Auth / session | `app/shopify.server.ts`, `prisma/schema.prisma` (`Session`), `app/routes/auth.$.tsx`, `app/routes/app.tsx` |
| Webhooks | `app/routes/webhooks.app.uninstalled.tsx`, `app/routes/webhooks.app.scopes_update.tsx` |
| Navigation | `app/lib/navigation.ts`, `app/components/AppNavigation.tsx` |
| Merchant flow | `app/routes/app.products*.tsx`, `ProductOnboardingPage.tsx`, `QuickStartPage.tsx`, `DetailedSetupPage.tsx`, `ProductDecisionDashboardPage.tsx` |
| Simulation | `app/modules/products/lib/simulateProjectedOutcome.ts`, `StrategyControls.tsx` |
| Data access | `prismaTrackedProductRepository.ts`, `prismaCostProfileRepository.ts` |
| MVP progress | `docs/product-roadmap.md` |
| Architecture | `docs/README_ARCHITECTURE.md`, `docs/architecture-backlog.md` |

---

## 19. Prioritized Action Plan

### Immediate (Must fix before submission)

| Item | Priority | Est. effort | Reason |
| --- | --- | --- | --- |
| Implement + register mandatory compliance webhooks | P0 | 1–2 days | Automated App Store gate |
| Publish Privacy Policy URL; wire listing | P0 | 0.5–1 day | Listing / legal requirement |
| Deploy app; replace `example.com` URLs; align OAuth path with `/auth` | P0 | 0.5 day | Install + review impossible otherwise |
| Purge shop data on uninstall and/or `shop/redact` | P0 | 0.5–1 day | Compliance + data lifecycle |
| Fix App Home (redirect to Products or real onboarding) | P0 | 2–4 hours | First reviewer impression |
| Add Support email + Support URL | P0 | 2–4 hours | Listing requirement |
| Hide/remove/redirect empty Pricing/Discounts/Settings (and inert legacy CTAs) | P1 | 0.5 day | Avoid unfinished-surface rejection |
| Replace landing placeholder copy | P1 | 2–4 hours | Professionalism / listing quality |

### Before Public Launch

| Item | Priority | Est. effort | Reason |
| --- | --- | --- | --- |
| App icon, screenshots, listing description, demo script for reviewers | P1 | 1–2 days | Conversion + smoother review |
| Align webhook API version with runtime ApiVersion | P2 | 1–2 hours | Config consistency |
| Terms of Service (if required by distribution/legal posture) | P1 | 0.5 day | Legal completeness |
| Settings page with support links / data practices summary | P2 | 0.5–1 day | Merchant trust |
| Untrack product UI | P2 | 0.5 day | Lifecycle completeness |
| Structured logging + basic error monitoring | P2 | 1 day | Production ops |
| Smoke test checklist on a development store | P1 | 0.5 day | Catch install/auth/webhook regressions |

### Nice to Have (Post-launch)

| Item | Priority | Est. effort | Reason |
| --- | --- | --- | --- |
| Persist strategies / apply discounts to Shopify | P3 | Large | Roadmap expansion |
| Pricing & Discounts modules | P3 | Large | Nav currently disabled |
| Patch-based cost item updates (ARCH-001) | P3 | Medium | Scale / concurrency |
| Automated tests for loaders/services/simulation | P3 | 2–4 days | Regression safety |
| Chunk large `nodes` enrichment | P3 | 0.5 day | Large catalogs |
| Rename shop fields / clean legacy ProductList + cost-profile | P3 | 1–2 days | Maintainability |

---

## 20. Final Verdict

| Question | Answer |
| --- | --- |
| **Overall Approval Readiness** | **38%** — solid embedded MVP product core; failing App Store compliance, listing, and production-config bar. |
| **Overall MVP Completion** | **88%** — tracked products → cost → selling price → live Decision Workspace largely delivered per roadmap. |
| **Estimated remaining work before submission** | Compliance webhooks + data deletion, privacy/support URLs, production hosting/URLs, App Home fix, shell-route cleanup, listing assets. |
| **Estimated time before Shopify submission** | **~1–2 weeks** calendar time for a focused team (including legal/privacy text, hosting, Partner Dashboard listing, and a clean install test) — **~3–5 engineering days** of pure build work if legal/assets are ready in parallel. |
| **Confidence level** | **High** that compliance/config gaps would block submission today; **Medium-High** that the core merchant workflow would satisfy a reviewer *after* those gaps close. |
| **Would you personally submit this application today?** | **No.** |

**Why not today**

1. Mandatory compliance webhooks are absent — this is a known hard fail for App Store distribution.  
2. Privacy Policy and support contacts are missing.  
3. Production URLs are still `https://example.com`, with an OAuth redirect path that does not match the app’s `/auth` prefix.  
4. First-run App Home is an empty Dashboard — a strong “not finished” signal.  
5. Uninstall does not remove merchant business data, and `shop/redact` is unimplemented.

**After Immediate fixes**, this codebase is close to a credible MVP submission: the merchant value path is real, scopes are minimal, shop isolation is sound, and the Decision Workspace is coherent. Until then, recommendation remains **❌ Not Ready**.

---

*End of AP-001 audit. No application code or configuration was modified while producing this report.*
