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

### PP-0012

Quick Start cost entry: open/create `QUICK_START` profile, single total cost input, save `totalCost`, product details summary with Edit Total Cost.

### PP-0013

Detailed Cost Builder foundation: `CostItemType` taxonomy (mapped to `CostCategory`), five-category breakdown form, Break Down My Costs CTA, save CostItems and transition mode to `DETAILED` without changing `totalCost` or calculating totals.

### PP-0014

Decision Dashboard MVP: replace post–Quick Start / Detailed summary screens with a product Decision Dashboard (header via Shopify enrichment, cost summary, Pricing Decisions placeholder, Improve Accuracy / Edit Cost Breakdown, Edit Total Cost). No Decision Engine, profit, margin, or selling price.

### PP-0015 (Selling Price Setup)

Selling Price Setup: nullable `sellingPrice` on CostProfile, `updateSellingPrice` / `saveSellingPrice`, Selling Price page, Product Overview Current Selling Price card (replaces Pricing Decisions placeholder). Collect and persist only — no Decision Engine, margin, or calculations.

### PP-0014 — Complete Selling Price Flow

Finish Selling Price workflow only: reliable save (input sync + persist + redirect to Product Overview), edit prefill, Overview Current Selling Price (`Not Set` / shop-currency amount) with Set/Edit CTAs, validation and error preservation. No Decision Simulator, strategies, profit, or Product Costing changes.

### PP-0015 — Decision Workspace Foundation

Reorganize Product Overview into Decision Workspace: Product Summary, Projected Outcome placeholder, predefined Strategy cards (Configure inert), Product Costing section at bottom. UI foundation only — no Decision Engine, strategy logic, or calculations.

### PP-0015.1 — Decision Workspace UX Refinement

Refine Decision Workspace interaction model: remove Configure buttons, always-visible strategy controls with automatic activation, real-time client projection on every change, sticky Profit / Loss summary bar, status Profit / Loss. No persistence, history, or new business features.

### PP-0015.2 — Decision Workspace Refinement

Unify live simulation across all strategies; replace Facebook Ads / Festival Campaign with Coupon + Cashback; compact strategy settings layout; + Add Strategy with predefined Strategy Library; retain sticky Projected Outcome. No Product Costing / Quick Start changes, persistence, or custom strategy builder.

### PP-0015.3 — Strategy Compatibility Warning System

Advisory compatibility analysis after simulation: strategy category metadata, data-driven rules (e.g. multiple Price Adjustment), dynamic warning copy listing active strategies, Polaris warning below sticky Projected Outcome. Simulation never blocked; no calculation / Product Costing changes.

### PP-0015.3.1 — Active Strategy Detection Fix

Compatibility warnings analyse only field-active strategies (numeric value > 0, Free Shipping checked). Each strategy owns an `isActive` rule; inactive / empty strategies never appear in warning lists. No UI redesign or calculation changes.

### PP-0015.4 — Free Shipping Strategy Refinement

Free Shipping is a merchant decision (checkbox) with a Shipping Cost input for the monetary impact. Cost input stays visible but disabled while unchecked; enabled Free Shipping deducts the merchant-entered amount from projected profit. Live recalculation, validation when enabled, no Product Costing / schema changes.

### PP-0015.4.2 — Quantity Discount Strategy (Threshold-Based)

Replace Quantity Discount with a threshold-based strategy: Minimum Quantity, Discount Type (percentage / fixed), Discount Value, and Simulated Order Quantity. Discount applies only when simulated qty ≥ minimum; reuses existing `applyMoneyOff` pricing. Independent from Discount strategy — no changes to other strategy calculations.

### PP-0015.4.3 — Improve Quantity Discount UX

Clarify Quantity Discount labels only: “Apply when customer buys at least” (threshold), “Simulation” / “Customer buys” (order size), Discount label aligned with Discount strategy. No calculation, activation, or other-strategy changes.

### PP-0015.6 — Decision Workspace UX Polish

Polish Decision Workspace for MVP usability: clear section hierarchy (Product Summary → sticky Projected Outcome → Decision Strategies → Product Costing), consistent short labels, uniform numeric inputs, denser strategy settings, sticky summary clearance, subdued compatibility warnings, responsive and accessible controls. UI polish only — no calculation, engine, persistence, or routing changes.

### PP-0015.6.1 — Restore Sticky Projected Outcome

Restore sticky Projected Outcome after PP-0015.6 regression: summary must remain visible while editing strategies. Fix containing-block layout only — no redesign, calculation, strategy control, or warning-system changes.

---

## Upcoming

*(None scheduled.)*

---

## Notes for maintainers

- Move a prompt from Upcoming → Completed only when its acceptance criteria are met in the repo.
- Revisions use a suffix (e.g. `PP-0003-R1`) and stay listed under Completed alongside the original when both are historical record.
- If a prompt is cancelled, mark it explicitly rather than deleting history.
