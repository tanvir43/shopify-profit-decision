# Product Roadmap

Implementation progress for ProfitPilot, tracked by Prompt ID.

Update this file when a prompt is completed, revised, or scheduled. Keep entries short; detailed design lives in ADRs, schema comments, and module contracts.

---

## Completed

### PP-0001

Project foundation: Shopify App (React Router) bootstrap, app shell, and baseline repository setup for ProfitPilot.

### PP-0002

Product domain architecture: module layout under `app/modules/products`, repository/service/mapper contracts, removal of unnecessary auth wrappers in favor of official Shopify authentication (ADR-001).

### PP-0003

Cost Profile Prisma domain model: `CostProfile`, `CostItem`, `CostUnit`, `CostCategory` — business facts only, no pricing formulas or UI.

### PP-0003-R1

Cost Profile domain model revision: retain enum categories with `CUSTOM`; allow multiple items per category; add `isActive` and `sortOrder` (ADR-004).

### PP-0004

Cost Profile architectural boundaries: aggregate-oriented `CostProfileRepository` / `CostProfileService` / mapper contracts; no generic CRUD; no item repository (ADR-002, ADR-003). Patch-based item updates deferred (ARCH-001).

### PP-0004.1

Permanent architecture documentation: `docs/` as the single source of truth for backlog, ADRs, roadmap, and architecture README.

### PP-0007

Cost Profile route layer + minimal read-only page: `/app/products/:productId/cost-profile` loader via `CostProfileService`, ensure-on-miss, ErrorBoundary strategy (ADR-005). No editing UI or actions.

### PP-0008

Merchant-facing Cost Profile UX: header (product, currency, status), count-only summary, empty state or read-only item list, single primary CTA. Polaris web components; no money math; no inline editing (ADR-006).

### PP-0010

Tracked Products Workspace: `TrackedProduct` reference model (no Shopify catalog sync), repository/service, empty state + list by Shopify product ID and tracked date. Resource Picker deferred.

### PP-0011

Cost Profile onboarding choice screen: product details route (`/app/products/:trackedProductId`), Open action from workspace, two-path onboarding UI, placeholder Quick Start and Detailed Setup routes. DB-only loader; no Cost Profile creation or Shopify calls.

---

## Upcoming

### PP-0012

*(Placeholder — Quick Start cost entry flow.)*

### PP-0013

*(Placeholder — Detailed Cost Builder flow.)*

---

## Notes for maintainers

- Move a prompt from Upcoming → Completed only when its acceptance criteria are met in the repo.
- Revisions use a suffix (e.g. `PP-0003-R1`) and stay listed under Completed alongside the original when both are historical record.
- If a prompt is cancelled, mark it explicitly rather than deleting history.
