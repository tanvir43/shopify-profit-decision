# Architecture Decision Log

Record of important technical decisions for ProfitPilot.

Each entry is an Architecture Decision Record (ADR). ADRs are append-only in spirit: if a decision is reversed, add a new ADR that supersedes the old one and mark the old entry `Superseded`.

## Index

| ADR | Title | Date | Prompt | Status |
| --- | --- | --- | --- | --- |
| [ADR-001](#adr-001--official-shopify-authentication) | Official Shopify Authentication | 2026-07-27 | PP-0002 | Accepted |
| [ADR-002](#adr-002--costprofile-is-aggregate-root) | CostProfile is Aggregate Root | 2026-07-28 | PP-0003 / PP-0004 | Accepted |
| [ADR-003](#adr-003--no-generic-crud-repository) | No Generic CRUD Repository | 2026-07-28 | PP-0004 | Accepted |
| [ADR-004](#adr-004--enum-based-cost-categories-with-custom) | Enum-based Cost Categories with CUSTOM | 2026-07-28 | PP-0003-R1 | Accepted |
| [ADR-005](#adr-005--product-scoped-cost-profile-url-without-products-layout-nesting) | Product-scoped Cost Profile URL without Products layout nesting | 2026-07-28 | PP-0007 | Accepted |
| [ADR-006](#adr-006--cost-profile-merchant-ui-simplicity) | Cost Profile merchant UI simplicity | 2026-07-28 | PP-0008 | Accepted |
| [ADR-007](#adr-007--costitemtype-maps-to-costcategory) | CostItemType maps to CostCategory | 2026-07-30 | PP-0013 | Accepted |
| [ADR-008](#adr-008--strategy-compatibility-warnings-never-block-simulation) | Strategy compatibility warnings never block simulation | 2026-08-02 | PP-0015.3 | Accepted |

---

## ADR-001 — Official Shopify Authentication

| Field | Value |
| --- | --- |
| **ADR ID** | ADR-001 |
| **Date** | 2026-07-27 |
| **Prompt ID** | PP-0002 |
| **Status** | Accepted |

### Decision

Use Shopify’s official authentication flow exclusively via `authenticate` / `login` exported from `app/shopify.server.ts` (Shopify App React Router). Do not introduce a custom auth wrapper or parallel session layer for Admin routes.

### Context

ProfitPilot is an embedded Shopify app. Session storage, OAuth, offline tokens, and webhook verification are platform concerns already solved by `@shopify/shopify-app-react-router` and Prisma session storage. A thin local wrapper (`requireAdminAuth`) added no value and risked drifting from Shopify’s recommended patterns.

### Alternatives Considered

1. **Custom auth helper wrapping `authenticate.admin`** — rejected; indirection without behavior.
2. **Custom JWT / API-key auth for Admin UI** — rejected; breaks App Bridge / embedded session model.
3. **Official Shopify authentication (chosen)** — keep template `shopifyApp` configuration and call `authenticate.admin(request)` in loaders/actions.

### Reasoning

Official auth stays compatible with Shopify CLI, token rotation (`expiringOfflineAccessTokens`), App Store distribution, and documented redirect rules. Removing wrappers keeps the security surface smaller and onboarding clearer for new developers.

### Consequences

- All protected routes authenticate through `~/shopify.server`.
- Shop / tenant identity comes from the Shopify session, not a home-grown user table.
- Future API surfaces (if any) must still respect Shopify auth or be explicitly designed as unauthenticated webhook/HMAC paths.

---

## ADR-002 — CostProfile is Aggregate Root

| Field | Value |
| --- | --- |
| **ADR ID** | ADR-002 |
| **Date** | 2026-07-28 |
| **Prompt ID** | PP-0003, PP-0004 |
| **Status** | Accepted |

### Decision

`CostProfile` is the aggregate root for product cost structure. `CostItem` entities have no independent lifecycle, repository, or cross-module API. Persistence and business writes always go through the profile.

### Context

ProfitPilot is a decision engine, not an accounting ledger. Pricing, Safe Discount, Break-even, Bundle, and AI Advisor all need a coherent cost structure per Shopify product per shop. Items are facts owned by that structure; addressing them outside the profile invites inconsistent currency, ordering, and active-filter rules.

### Alternatives Considered

1. **CostItem as a first-class aggregate with its own repository** — rejected; splits invariants across roots.
2. **Anemic profile + free CRUD on items from routes** — rejected; business rules would leak into UI/actions.
3. **CostProfile aggregate root (chosen)** — natural key `shop + productId`; items cascaded and saved with the parent.

### Reasoning

Aggregate boundaries match the domain sentence: “a product has one cost profile containing many cost lines.” Downstream modules consume decision projections from `CostProfileService`, not raw item tables. `replaceItems` / `updateMeta` / `ensureForProduct` keep orchestration in the service layer.

### Consequences

- No `CostItemRepository`.
- Prisma cascade delete on profile removal is acceptable and expected.
- Concurrent item-level editing is deferred (see ARCH-001); MVP uses full item replace.
- Schema and TypeScript types treat `items` as part of the profile, not a sibling resource.

---

## ADR-003 — No Generic CRUD Repository

| Field | Value |
| --- | --- |
| **ADR ID** | ADR-003 |
| **Date** | 2026-07-28 |
| **Prompt ID** | PP-0004 |
| **Status** | Accepted |

### Decision

Repositories expose methods that match **business access patterns**, not generic CRUD (`findById`, `create`, `update`, `delete`, `list`). Example for Cost Profiles: `findByProduct`, `findByProducts`, `save`.

### Context

Generic CRUD repositories encourage routes and services to think in tables instead of use cases. Multi-tenant Shopify apps must always scope by `shop`. Cost Profiles are loaded by Shopify `productId`, often in batches for bundles — not by opaque internal IDs from the UI.

### Alternatives Considered

1. **Generic `BaseRepository<T>` CRUD** — rejected; hides tenant rules and invents unused methods.
2. **Prisma Client called directly from routes** — rejected; couples HTTP to persistence and skips domain mapping.
3. **Intent-named repository ports (chosen)** — small interfaces; mappers isolate Prisma shapes.

### Reasoning

Intent-named methods document *why* data is loaded. `findByProducts` exists because Bundle / multi-product advisors must avoid N+1. `save` exists because the aggregate is written as one persistence boundary. Feature modules depend on services, never on repositories.

### Consequences

- New repository methods require a real consumer need, not speculative completeness.
- Internal `id` may exist for storage, but natural keys drive public ports.
- Services own ensure-semantics, active filtering, and validation before `save`.

---

## ADR-004 — Enum-based Cost Categories with CUSTOM

| Field | Value |
| --- | --- |
| **ADR ID** | ADR-004 |
| **Date** | 2026-07-28 |
| **Prompt ID** | PP-0003-R1 |
| **Status** | Accepted |

### Decision

`CostCategory` is a controlled enum: `PRODUCT`, `PACKAGING`, `SHIPPING`, `TRANSACTION`, `CUSTOM`. Multiple items may share a category. `CUSTOM` is the escape hatch until a first-class category is justified. New categories are added by extending the enum (controlled schema change), not by free-text or a parallel category table in MVP.

### Context

Categories classify cost facts for reporting, UI grouping, and future AI labeling. They must not constrain how many lines share a bucket. A free-string category would fragment analytics; a full taxonomy table is premature before product usage is known.

### Alternatives Considered

1. **Free-string / merchant-defined category labels only** — rejected for MVP; unstable reporting keys.
2. **Normalized `Category` table with merchant CRUD** — deferred; overbuilt until taxonomy demand is proven.
3. **Closed enum without CUSTOM** — rejected; forces fake mappings or blocking merchants.
4. **Enum + CUSTOM (chosen)** — typed common buckets; escape hatch; enum extension later.

### Reasoning

Enums keep TypeScript and Prisma aligned and make downstream calculators / advisors predictable. `CUSTOM` absorbs unknowns without schema churn. Promoting a popular custom pattern to a first-class enum value is an explicit, reviewable change.

### Consequences

- UI may still show a display name for custom lines; the stored taxonomy value remains `CUSTOM` until promoted.
- Adding a category is a deliberate migration + ADR/update, not an ad-hoc string.
- Category is never unique per profile — uniqueness lives in item identity within the aggregate.

---

## ADR-005 — Product-scoped Cost Profile URL without Products layout nesting

| Field | Value |
| --- | --- |
| **ADR ID** | ADR-005 |
| **Date** | 2026-07-28 |
| **Prompt ID** | PP-0007 |
| **Status** | Accepted |

### Decision

Expose Cost Profiles at `/app/products/:productId/cost-profile` via the React Router flat-route file `app.products_.$productId.cost-profile.tsx`. The trailing underscore on `products_` keeps a product-scoped URL while **opting out** of layout nesting under `app.products.tsx`. The route still nests under `app.tsx` (embedded shell / App Bridge).

### Context

Cost Profile is keyed by `shop + productId` (ADR-002). Merchants open a profile for a product, so the URL should be product-based. Naively nesting under `app.products.tsx` would force that leaf list route to become an `Outlet` layout and split the list into `_index` — coupling every future product child to the products list shell.

### Alternatives Considered

1. **Nest under products layout** (`app.products.tsx` + `app.products.$productId.cost-profile.tsx`) — rejected for MVP; requires converting the products list into a layout parent without shared UI benefit yet.
2. **Resource URL** (`/app/cost-profiles/:productId`) — clean module boundary, but weaker product discoverability in the Admin URL path.
3. **Product path without layout nesting (chosen)** — `products_` escape: product-scoped URL, thin route under `app`, no products list refactor.

### Reasoning

Product identity belongs in the path; products-list layout ownership does not. React Router’s trailing-`_` convention is the intentional escape hatch for nested URLs without nested layouts. The Cost Profile page/module owns presentation; the route stays auth + param parse + `CostProfileService` only.

### Consequences

- File naming: `app/routes/app.products_.$productId.cost-profile.tsx`.
- `productId` is a single path segment (URL-encode GIDs such as `gid://shopify/Product/123`).
- Future product-detail layout nesting can be introduced deliberately later without rewriting this URL.
- Server composition of Prisma → repository → service lives in `costProfileService.server.ts`; routes never import Prisma or repositories.

---

## ADR-006 — Cost Profile merchant UI simplicity

| Field | Value |
| --- | --- |
| **ADR ID** | ADR-006 |
| **Date** | 2026-07-28 |
| **Prompt ID** | PP-0008 |
| **Status** | Accepted |

### Decision

The Cost Profile page is a **usability-first merchant surface**. It must answer only three questions within ~30 seconds: which product, whether costs are configured, and what to do next. Prefer progressive disclosure over complete data dump. Prefer Polaris web components (`s-*`) with at most **one** prominent primary CTA. Summary shows **item counts only** — never money totals or pricing math.

### Context

ProfitPilot must feel simpler than a spreadsheet. First-time merchants are not accountants. Showing values, notes, formulas, or inline editors on the first screen creates cognitive load and invites “accounting UI” expectations that conflict with the decision-engine product.

### Alternatives Considered

1. **Full cost ledger on day one** (values, totals, notes, inline edit) — rejected; too dense for first open.
2. **Table-first IndexTable layout** — rejected for MVP read-only list; tables imply bulk ops and dense columns.
3. **Simple header + count summary + list/empty state (chosen)** — status from presence of items; one CTA (`Add First Cost` or `Manage Cost Items`).

### Reasoning

Merchants need orientation before configuration. Counts answer “have I started?” without inventing profit math in the UI layer. Empty-state copy explains business outcome (smarter pricing later), not implementation. Loader maps domain → page DTO; React stays presentation-only.

### Consequences

- Cost Profile UI conventions for future screens: single primary CTA, no competing actions, no money on this page until a pricing module owns it.
- `Configured` means at least one cost item exists; `Not Configured` means the list is empty.
- Editing flows wire into the existing CTA slots later — do not add secondary “edit” chrome on list rows until needed.
- Prefer list/card rows (name, category, type, active badge) over tables for read-only cost lines.

---

## ADR-007 — CostItemType maps to CostCategory

| Field | Value |
| --- | --- |
| **ADR ID** | ADR-007 |
| **Date** | 2026-07-30 |
| **Prompt ID** | PP-0013 |
| **Status** | Accepted |

### Decision

Detailed Cost Builder uses a merchant-facing `CostItemType` enum (`PURCHASE`, `PACKAGING`, `SHIPPING`, `PAYMENT_FEES`, `OTHER`). Persistence continues to use `CostCategory` (ADR-004). Mapping:

| CostItemType | CostCategory |
| --- | --- |
| PURCHASE | PRODUCT |
| PACKAGING | PACKAGING |
| SHIPPING | SHIPPING |
| PAYMENT_FEES | TRANSACTION |
| OTHER | CUSTOM |

`CostItem` already exists as the aggregate child; Detailed Setup writes `name`/`value`/`category` (label/amount/type in product language) with `unit: FIXED`. Empty amounts mean “not provided” and omit that line. Saving sets `mode` to `DETAILED` and leaves `totalCost` unchanged.

### Context

PP-0013 names types for merchants (no accounting jargon). Renaming or replacing `CostCategory` in Prisma would churn existing contracts and migrations without changing stored facts. A parallel Prisma enum would duplicate taxonomy.

### Alternatives Considered

1. **Rename Prisma `CostCategory` values** — rejected for MVP; high migration cost for display naming.
2. **Add a second Prisma enum `CostItemType`** — rejected; two persistence taxonomies for one fact.
3. **Map CostItemType → CostCategory (chosen)** — keeps ADR-004 storage; merchant UI uses friendlier names.

### Consequences

- UI and Detailed Setup validation speak `CostItemType`; repository/mapper stay on `CostCategory`.
- Promoting OTHER/CUSTOM or renaming buckets remains an explicit schema + ADR change.
- Do not invent a second CostItem table or overwrite `totalCost` when entering DETAILED mode.

---

## ADR-008 — Strategy compatibility warnings never block simulation

| Field | Value |
| --- | --- |
| **ADR ID** | ADR-008 |
| **Date** | 2026-08-02 |
| **Prompt ID** | PP-0015.3 |
| **Status** | Accepted |

### Decision

The Decision Workspace may advise on uncommon strategy combinations, but **must never** disable, remove, or ignore strategies, or refuse to calculate. Compatibility analysis is a separate layer that runs **after** simulation. Warnings are derived from strategy category metadata and data-driven rules — not hard-coded strategy-name branches. Copy uses advisory language only (`Warning`, `Recommendation`, review guidance); never `Critical`, `Error`, `Blocked`, or `Invalid`.

### Context

ProfitPilot is a simulator. Merchants own pricing decisions; ProfitPilot owns accurate calculation. Stacking multiple Price Adjustment strategies (Discount + Coupon + Bundle) is uncommon but legitimate to explore. Blocking or silently dropping effects would undermine trust in the projection.

### Alternatives Considered

1. **Disable conflicting strategies in the UI** — rejected; prevents exploration.
2. **Hard-code messages naming Bundle / Discount / Coupon** — rejected; brittle when the library grows.
3. **Post-simulation metadata-driven warnings (chosen)** — preserves full math; educates via dynamic active-strategy lists.

### Consequences

- Pipeline: Strategy Inputs → Simulation Engine → Profit / Loss → Compatibility Analysis → Warning UI.
- New strategies need a catalog `category` and an activation rule (`strategyActivation.ts`); new rules register in `COMPATIBILITY_RULES` without touching profit formulas.
- Compatibility analysis asks each workspace strategy whether it is field-active (value > 0 / checked) before grouping by category — workspace membership alone does not trigger warnings (PP-0015.3.1).
- Categories stay internal metadata — not shown as UI chips.
- Simulation, profit/margin formulas, and Product Costing remain unchanged by this layer.
