import { validateQuickStartTotalCost } from "~/modules/cost-profiles/lib/validateQuickStartTotalCost";

/**
 * Normalizes Shopify Money amounts (any decimal precision) into Quick Start cost format.
 */
export function normalizeShopMoneyAmount(
  raw: string | null | undefined,
): string | null {
  if (raw == null || raw.trim() === "") {
    return null;
  }

  const value = Number(raw.trim().replace(/,/g, ""));
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  const result = validateQuickStartTotalCost(value.toFixed(2));
  return result.ok ? result.value : null;
}
