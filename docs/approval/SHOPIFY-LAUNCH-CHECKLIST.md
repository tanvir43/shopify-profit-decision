# Shopify Launch Checklist

Track launch-blocker and reviewer-experience work for ProfitPilot App Store submission.

| ID | Item | Status |
| --- | --- | --- |
| LS-005A | Empty State Onboarding | ✅ Complete |

## LS-005A — Empty State Onboarding

| Field | Value |
| --- | --- |
| **Status** | ✅ Complete |
| **Visibility** | Shown only when Tracked Products == 0; hidden once any product is tracked |
| **Placement** | Above the existing empty-state “Add Product” section |
| **Implementation** | `app/modules/products/components/EmptyStateOnboardingCard.tsx` (wired in `ProductsPage.tsx` when `trackedCount === 0`) |
| **CTA** | “Add Your First Product” reuses the existing `onAddProducts` / Resource Picker handler |
| **Scope** | Educational empty-state card only — no calculation, auth, DB, or workflow changes |
