/**
 * Suggest a selling price from product cost and target profit margin %.
 *
 * Selling Price = Product Cost / (1 - Margin)
 * where Margin is expressed as a fraction (e.g. 40 → 0.40).
 *
 * Returns a decimal string with two fractional digits, or null when inputs
 * cannot produce a finite positive price.
 */
export function calculateSuggestedSellingPrice(
  productCost: string | null,
  marginPercent: number,
): string | null {
  if (productCost == null || productCost === "") {
    return null;
  }

  const cost = Number(productCost);
  if (!Number.isFinite(cost) || cost <= 0) {
    return null;
  }

  if (!Number.isFinite(marginPercent) || marginPercent <= 0 || marginPercent >= 100) {
    return null;
  }

  const denominator = 1 - marginPercent / 100;
  if (denominator <= 0) {
    return null;
  }

  const suggested = cost / denominator;
  if (!Number.isFinite(suggested) || suggested <= 0) {
    return null;
  }

  return suggested.toFixed(2);
}
