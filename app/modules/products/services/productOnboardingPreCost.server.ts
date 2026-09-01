import { validateQuickStartTotalCost } from "~/modules/cost-profiles/lib/validateQuickStartTotalCost";
import type { authenticate } from "~/shopify.server";

import type { TrackedProduct } from "../types/TrackedProduct";
import { fetchVariantUnitCost } from "./shopifyProductsService.server";
import { resolveTrackedProductShopifyVariantId } from "./variantSelection.server";

type AdminGraphql = Awaited<ReturnType<typeof authenticate.admin>>["admin"];

/**
 * Shopify inventory cost available for the current product/variant scope.
 */
export async function loadOnboardingShopifyPreCost(
  admin: AdminGraphql,
  tracked: TrackedProduct,
): Promise<string | null> {
  const shopifyVariantId = await resolveTrackedProductShopifyVariantId(
    admin,
    tracked,
  );

  if (!shopifyVariantId) {
    return null;
  }

  const rawCost = await fetchVariantUnitCost(admin, shopifyVariantId);
  if (!rawCost) {
    return null;
  }

  const result = validateQuickStartTotalCost(rawCost);
  return result.ok ? result.value : null;
}
