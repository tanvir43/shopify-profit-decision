import type { authenticate } from "~/shopify.server";

import {
  applyComparisonPriceRowsSequentially,
  readComparisonApplyFormData,
  summarizeComparisonApplyResults,
  verifyComparisonApplySelection,
  type ApplyComparisonPricesActionData,
  type ComparisonApplyRowResult,
  type VerifiedComparisonApplyRow,
} from "../lib/compareApplyToShopify";
import {
  fetchVariantShopifyContext,
  updateVariantPrice,
} from "./applyToShopify.server";
import { loadCompareScenariosPageData } from "./compareScenarios.server";
import { trackedProductService } from "./trackedProductService.server";

type AdminGraphql = Awaited<ReturnType<typeof authenticate.admin>>["admin"];

/**
 * Applies selected comparison simulated selling prices to Shopify variants.
 * Reuses the existing single-product price mutation. Does not update cost,
 * inventory, or create discounts/campaigns.
 */
export async function handleApplyComparisonPricesAction(
  admin: AdminGraphql,
  shop: string,
  formData: FormData,
): Promise<ApplyComparisonPricesActionData> {
  const parsed = readComparisonApplyFormData(formData);
  if (!parsed.ok) {
    return {
      ok: false,
      appliedCount: 0,
      failedCount: 0,
      results: [],
      error: parsed.error,
    };
  }

  const selectedIds = parsed.selections.map(
    (selection) => selection.trackedProductId,
  );
  const pageData = await loadCompareScenariosPageData(
    admin,
    shop,
    selectedIds,
  );

  const verifiedRows: VerifiedComparisonApplyRow[] = [];
  const precheckFailures: ComparisonApplyRowResult[] = [];

  for (const selection of parsed.selections) {
    const tracked = await trackedProductService.getTrackedProduct(
      shop,
      selection.trackedProductId,
    );

    if (!tracked) {
      precheckFailures.push({
        trackedProductId: selection.trackedProductId,
        shopifyVariantId: selection.shopifyVariantId,
        productTitle: "Unknown product",
        variantTitle: "Unknown variant",
        ok: false,
        error: "We couldn't update Shopify. Try again.",
      });
      continue;
    }

    const verified = verifyComparisonApplySelection({
      products: pageData.products,
      selection,
      strategies: parsed.strategies,
    });

    if (!verified.ok) {
      precheckFailures.push({
        ...verified.identity,
        ok: false,
        error: verified.error,
      });
      continue;
    }

    const variantContext = await fetchVariantShopifyContext(
      admin,
      selection.shopifyVariantId,
    );

    if (!variantContext) {
      precheckFailures.push({
        trackedProductId: verified.confirmation.trackedProductId,
        shopifyVariantId: verified.confirmation.shopifyVariantId,
        productTitle: verified.confirmation.productTitle,
        variantTitle: verified.confirmation.variantTitle,
        ok: false,
        error:
          "The selected variant could not be found in Shopify. Refresh and try again.",
      });
      continue;
    }

    if (variantContext.shopifyProductId !== tracked.shopifyProductId) {
      precheckFailures.push({
        trackedProductId: verified.confirmation.trackedProductId,
        shopifyVariantId: verified.confirmation.shopifyVariantId,
        productTitle: verified.confirmation.productTitle,
        variantTitle: verified.confirmation.variantTitle,
        ok: false,
        error: "The selected variant does not belong to this product.",
      });
      continue;
    }

    verifiedRows.push({
      trackedProductId: verified.confirmation.trackedProductId,
      shopifyVariantId: variantContext.shopifyVariantId,
      shopifyProductId: variantContext.shopifyProductId,
      productTitle: verified.confirmation.productTitle,
      variantTitle: verified.confirmation.variantTitle,
      newPrice: verified.confirmation.newPrice,
    });
  }

  if (verifiedRows.length === 0) {
    return summarizeComparisonApplyResults(precheckFailures);
  }

  const applied = await applyComparisonPriceRowsSequentially(
    verifiedRows,
    async ({ shopifyProductId, shopifyVariantId, price }) =>
      updateVariantPrice(admin, shopifyProductId, shopifyVariantId, price),
  );

  return summarizeComparisonApplyResults([
    ...precheckFailures,
    ...applied.results,
  ]);
}
