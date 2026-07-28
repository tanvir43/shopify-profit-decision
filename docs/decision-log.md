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
