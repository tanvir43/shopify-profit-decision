# Shopify Launch Checklist

Track launch-blocker and reviewer-experience work for ProfitPilot App Store submission.

| ID | Item | Status |
| --- | --- | --- |
| LS-005A | Empty State Onboarding | ✅ Complete |
| LS-005B | Selling Price Required Before Strategy Setup | ✅ Complete |

## LS-005A — Empty State Onboarding

| Field | Value |
| --- | --- |
| **Status** | ✅ Complete |
| **Visibility** | Shown only when Tracked Products == 0; hidden once any product is tracked |
| **Placement** | Above the existing empty-state “Add Product” section |
| **Implementation** | `app/modules/products/components/EmptyStateOnboardingCard.tsx` (wired in `ProductsPage.tsx` when `trackedCount === 0`) |
| **CTA** | “Add Your First Product” reuses the existing `onAddProducts` / Resource Picker handler |
| **Scope** | Educational empty-state card only — no calculation, auth, DB, or workflow changes |

## LS-005B — Selling Price Required Before Strategy Setup

| Field | Value |
| --- | --- |
| **Status** | ✅ Complete |
| **Rule** | Strategy changes are not applied when Selling Price is missing, null, undefined, or ≤ 0 |
| **Strategies UX** | Cards stay fully browsable and editable; save/apply is blocked with a validation modal |
| **Validation Modal** | “Selling Price Required” + body copy + primary “Set Selling Price” CTA |
| **CTA** | “Set Selling Price” reuses the Product Summary inline Selling Price Edit handler |
| **Product Summary** | Existing `s-banner` warning tone when Selling Price is not ready |
| **Implementation** | `ProductDecisionDashboardPage.tsx`, `StrategyControls.tsx`, `InlineSellingPriceEditor.tsx` |
| **Scope** | Workflow validation only — no calculation, Decision Engine, DB, auth, or Shopify config changes |
