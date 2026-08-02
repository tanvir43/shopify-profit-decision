# ProfitPilot Architecture Guide

Onboarding document for developers joining ProfitPilot.

ProfitPilot is a Shopify embedded app and **decision engine**: it stores merchant cost facts and will power Pricing, Safe Discount, Break-even, Bundle, and AI Advisor modules. It is not an accounting system.

For lasting decisions, read `decision-log.md`. For deferred work, read `architecture-backlog.md`. For prompt progress, read `product-roadmap.md`.

---

## High-level architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Shopify Admin (embedded)                │
└─────────────────────────────┬───────────────────────────────┘
                              │ App Bridge / session
┌─────────────────────────────▼───────────────────────────────┐
│  Routes (React Router loaders / actions)                    │
│  authenticate.admin → parse I/O → call domain services      │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│  Feature modules (app/modules/*)                            │
│  UI pages/components + domain services                      │
│  Downstream modules depend on CostProfileService, not DB    │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│  Repositories (ports) + Mappers                             │
│  Intent-named persistence; Prisma isolated behind mappers   │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│  Prisma + PostgreSQL                                        │
│  Session (platform) · TrackedProduct (refs) ·               │
│  CostProfile / CostItem (domain facts)                      │
└─────────────────────────────────────────────────────────────┘
```

**External ownership:** Shopify owns Products. We store `TrackedProduct` / `productId` references (GID preferred), not a mirrored product catalog as source of truth.

**Multi-tenancy:** Every domain read/write is scoped by `shop` from the Shopify session.

---

## Module boundaries

| Module | Responsibility | Depends on |
| --- | --- | --- |
| `products` | Tracked Products Workspace (refs); Shopify product access port | DB (`TrackedProduct`); Shopify Admin API when enriching/picking |
| `cost-profiles` | Cost facts aggregate; decision projections | Own repository/mapper; never Pricing formulas |
| `pricing` | Future pricing decisions UI/logic | `CostProfileService` (not repository) |
| `discounts` | Future safe-discount flows | `CostProfileService` |
| `dashboard` / `settings` | App shell surfaces | Auth + shared components |

Rules:

- Feature modules **must not** import another module’s repository or Prisma models directly.
- Cross-module consumption goes through **service contracts** (and shared types where intentional).
- Platform concerns (`shopify.server.ts`, `db.server.ts`, webhooks) stay outside business modules.

---

## Layer responsibilities

| Layer | Owns | Does not own |
| --- | --- | --- |
| **Route** | Auth, HTTP/form parsing, status codes, wiring to services | Domain invariants, Prisma queries |
| **UI (module components/pages)** | Merchant interaction, presentation | Persistence, pricing math (until that module exists) |
| **Service** | Orchestration, validation, ensure-semantics, decision projections | Prisma Client, raw SQL |
| **Repository** | Load/save aggregates by business keys | Business rules beyond persistence integrity |
| **Mapper** | Prisma ↔ domain type conversion (Decimal, enums, dates) | Orchestration |
| **Prisma schema** | Durable facts and constraints | Calculators, UI order derived from timestamps alone |

Cost Profile write example: route → `CostProfileService.replaceItems` → validate → `CostProfileRepository.save` → mapper → Prisma.

---

## Folder organization

```
profit-decision/
├── app/
│   ├── components/          # Shared UI (layout, navigation)
│   ├── lib/                 # Shared non-domain utilities
│   ├── modules/             # Bounded feature modules
│   │   └── <feature>/
│   │       ├── components/
│   │       ├── services/
│   │       ├── repositories/
│   │       ├── types/
│   │       ├── mappers/
│   │       ├── *Page.tsx
│   │       └── index.ts     # Public barrel
│   ├── routes/              # React Router entrypoints (thin)
│   ├── shopify.server.ts    # Official Shopify app + auth
│   └── db.server.ts         # Prisma client singleton
├── prisma/
│   └── schema.prisma
└── docs/                    # Architecture source of truth (this folder)
```

Prefer extending an existing module over adding global `app/services` or `app/repositories` implementations for domain logic.

---

## Development principles

1. **Facts before formulas** — Cost Profile stores business facts; calculators live in consumer modules later.
2. **Aggregate integrity** — `CostProfile` is the root; items are not independently persisted (ADR-002).
3. **Intent over CRUD** — Repository methods mirror access patterns (ADR-003).
4. **Official Shopify auth** — No custom Admin auth stack (ADR-001).
5. **Typed taxonomy with escape hatch** — Enum categories + `CUSTOM` (ADR-004).
6. **Defer with a record** — Known better designs go in `architecture-backlog.md`, not as silent TODOs in random files.
7. **Contracts before implementations** — Interfaces and schema first when a prompt asks for architecture only.
8. **Shop on every query** — Tenant isolation is non-negotiable.

---

## Commit convention

Follow concise, imperative commit subjects aligned with existing history:

```
feat: <what capability was added>
refactor: <structural improvement without behavior change>
fix: <bug fix>
docs: <documentation only>
chore: <tooling / housekeeping>
```

Guidelines:

- Prefer one logical change per commit when practical.
- Reference the Prompt ID in the commit body when useful, e.g. `PP-0004`.
- Do not commit secrets (`.env`, tokens). Keep `.env` local.
- Do not mix unrelated refactors with feature work.

Examples from this repo:

- `feat: scaffold product domain architecture`
- `refactor: improve cost profile domain model`
- `feat: define cost profile domain contracts`

---

## Prompt convention

Work is driven by numbered prompts from the PRD / architecture program:

| Form | Meaning |
| --- | --- |
| `PP-NNNN` | Primary prompt (e.g. `PP-0004`) |
| `PP-NNNN-RN` | Revision of a prior prompt (e.g. `PP-0003-R1`) |
| `PP-NNNN.N` | Documentation or follow-up slice (e.g. `PP-0004.1`) |

Expectations:

- Each prompt states scope constraints (e.g. “contracts only”, “no migrations”).
- Respect “do not generate application code” / “documentation only” when stated.
- On completion, update `product-roadmap.md`.
- New lasting decisions → `decision-log.md` (new ADR).
- Intentional deferrals → `architecture-backlog.md` (`ARCH-NNN`).

---

## Documentation convention

| Document | Purpose | When to update |
| --- | --- | --- |
| `README_ARCHITECTURE.md` | Onboarding map | Module layout or principles change |
| `decision-log.md` | Accepted ADRs | Any durable technical choice |
| `architecture-backlog.md` | Deferred improvements | Trade-off postponed or later implemented |
| `product-roadmap.md` | Prompt progress | Prompt starts/finishes |

Rules:

- Documentation is the **single source of truth** for architecture intent; code comments support it, they do not replace it.
- Prefer clear Markdown, durable wording, and links between ADR / ARCH / Prompt IDs.
- Do not delete historical ADRs; supersede them.
- Keep application README (Shopify template) separate from this architecture set unless onboarding requires a short pointer.

---

## Related IDs (quick reference)

| ID | Topic |
| --- | --- |
| ADR-001 | Official Shopify authentication |
| ADR-002 | CostProfile aggregate root |
| ADR-003 | No generic CRUD repository |
| ADR-004 | Enum categories + CUSTOM |
| ADR-005 | Product-scoped Cost Profile URL without products layout nesting |
| ADR-006 | Cost Profile merchant UI simplicity |
| ADR-007 | CostItemType maps to CostCategory (PP-0013) |
| ADR-008 | Strategy compatibility warnings never block simulation (PP-0015.3 / PP-0015.3.1) |
| ARCH-001 | Patch-based cost item updates (deferred; use `replaceItems`) |
