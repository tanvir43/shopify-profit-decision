import {
  CostProfileValidationError,
  type CostProfile,
} from "~/modules/cost-profiles";
import { costProfileService } from "~/modules/cost-profiles/services/costProfileService.server";
import { detailedSetupService } from "~/modules/cost-profiles/services/detailedSetupService.server";
import { quickStartService } from "~/modules/cost-profiles/services/quickStartService.server";
import {
  COST_ITEM_TYPES,
} from "~/modules/cost-profiles/types/CostItemType";
import { emptyAmounts } from "~/modules/products/components/CostBreakdownForm";
import {
  fetchShopSetupContext,
  getCachedShopCurrency,
} from "~/lib/shopSetupContext.server";
import type { authenticate } from "~/shopify.server";

import {
  buildComparisonProduct,
  resolveShopScopedTrackedProducts,
  type CompareScenariosPageData,
} from "../lib/compareScenarios";
import type { TrackedProduct } from "../types";
import {
  fetchProductsByIds,
  type ShopifyProductEnrichment,
} from "./shopifyProductsService.server";
import { trackedProductService } from "./trackedProductService.server";
import { verifyVariantBelongsToTrackedProduct } from "./variantSelection.server";

type AdminGraphql = Awaited<ReturnType<typeof authenticate.admin>>["admin"];

export type CompareScenariosActionData =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Resolve selected tracked-product IDs to shop-scoped comparison rows.
 * Foreign-shop and unknown IDs are dropped — never returned.
 */
export async function loadCompareScenariosPageData(
  admin: AdminGraphql,
  shop: string,
  selectedIds: string[],
): Promise<CompareScenariosPageData> {
  const trackedForShop = (
    await Promise.all(
      selectedIds.map((id) => trackedProductService.getTrackedProduct(shop, id)),
    )
  ).filter((product): product is TrackedProduct => product != null);

  const tracked = resolveShopScopedTrackedProducts(selectedIds, trackedForShop);

  if (tracked.length === 0) {
    return { products: [] };
  }

  const shopifyProductIds = tracked.map((product) => product.shopifyProductId);
  const profilesByProductId = new Map<string, CostProfile[]>();

  try {
    const profiles = await costProfileService.getDecisionProfiles(
      shop,
      shopifyProductIds,
    );

    for (const profile of profiles) {
      const list = profilesByProductId.get(profile.productId) ?? [];
      list.push(profile);
      profilesByProductId.set(profile.productId, list);
    }
  } catch {
    // Cost data stays empty — comparison still renders selected products.
  }

  let enrichment = new Map<string, ShopifyProductEnrichment>();
  let currency =
    getCachedShopCurrency(shop) ??
    [...profilesByProductId.values()][0]?.[0]?.currency ??
    "USD";

  try {
    const context = await fetchShopSetupContext(admin, shop, shopifyProductIds);
    enrichment = context.products;
    currency = context.currency;
  } catch {
    // Catalog fields stay limited — never expose Shopify GIDs as titles.
  }

  return {
    products: tracked.map((product) => {
      const shopify = enrichment.get(product.shopifyProductId);

      return buildComparisonProduct({
        trackedProductId: product.id,
        title: shopify?.title ?? "Product unavailable",
        imageUrl: shopify?.imageUrl ?? null,
        imageAlt: shopify?.imageAlt ?? null,
        currency,
        variants: shopify?.variants ?? [],
        profiles: profilesByProductId.get(product.shopifyProductId) ?? [],
        selectedShopifyVariantId: product.selectedShopifyVariantId,
      });
    }),
  };
}

/**
 * Save Quick Start cost for one comparison row. Shop-scopes the tracked
 * product and verifies the variant before writing.
 */
export async function saveCompareScenarioQuickStartCost(
  admin: AdminGraphql,
  shop: string,
  input: {
    trackedProductId: string;
    shopifyVariantId: string;
    totalCostRaw: string;
    currency: string;
  },
): Promise<CompareScenariosActionData> {
  const tracked = await trackedProductService.getTrackedProduct(
    shop,
    input.trackedProductId,
  );

  if (!tracked) {
    return { ok: false, error: "We couldn't save your cost. Try again." };
  }

  const shopifyVariantId = input.shopifyVariantId.trim();

  if (shopifyVariantId) {
    try {
      await verifyVariantBelongsToTrackedProduct(
        admin,
        shop,
        tracked.id,
        shopifyVariantId,
      );
    } catch {
      return { ok: false, error: "We couldn't save your cost. Try again." };
    }
  } else {
    const products = await fetchProductsByIds(admin, [tracked.shopifyProductId]);
    const variants = products.get(tracked.shopifyProductId)?.variants ?? [];
    if (variants.length > 0) {
      return { ok: false, error: "We couldn't save your cost. Try again." };
    }
  }

  try {
    await quickStartService.saveQuickStartCost({
      shop,
      productId: tracked.shopifyProductId,
      shopifyVariantId,
      totalCostRaw: input.totalCostRaw,
      currency: input.currency,
    });

    return { ok: true };
  } catch (error) {
    if (error instanceof CostProfileValidationError) {
      return { ok: false, error: error.message };
    }

    return { ok: false, error: "We couldn't save your cost. Try again." };
  }
}

/**
 * Save Advanced Cost Setup for one comparison row. Shop-scopes the tracked
 * product and verifies the variant before writing.
 */
export async function saveCompareScenarioDetailedCost(
  admin: AdminGraphql,
  shop: string,
  input: {
    trackedProductId: string;
    shopifyVariantId: string;
    currency: string;
    amounts: ReturnType<typeof emptyAmounts>;
  },
): Promise<CompareScenariosActionData> {
  const tracked = await trackedProductService.getTrackedProduct(
    shop,
    input.trackedProductId,
  );

  if (!tracked) {
    return { ok: false, error: "We couldn't save your costs. Try again." };
  }

  const shopifyVariantId = input.shopifyVariantId.trim();

  if (shopifyVariantId) {
    try {
      await verifyVariantBelongsToTrackedProduct(
        admin,
        shop,
        tracked.id,
        shopifyVariantId,
      );
    } catch {
      return { ok: false, error: "We couldn't save your costs. Try again." };
    }
  } else {
    const products = await fetchProductsByIds(admin, [tracked.shopifyProductId]);
    const variants = products.get(tracked.shopifyProductId)?.variants ?? [];
    if (variants.length > 0) {
      return { ok: false, error: "We couldn't save your costs. Try again." };
    }
  }

  try {
    await detailedSetupService.saveDetailedBreakdown({
      shop,
      productId: tracked.shopifyProductId,
      shopifyVariantId,
      currency: input.currency,
      amounts: input.amounts,
    });

    return { ok: true };
  } catch (error) {
    if (error instanceof CostProfileValidationError) {
      return { ok: false, error: error.message };
    }

    return { ok: false, error: "We couldn't save your costs. Try again." };
  }
}

export function readCompareDetailedCostAmounts(
  formData: FormData,
): ReturnType<typeof emptyAmounts> {
  const amounts = emptyAmounts();

  for (const type of COST_ITEM_TYPES) {
    const raw = formData.get(type);
    amounts[type] = typeof raw === "string" ? raw : "";
  }

  return amounts;
}
