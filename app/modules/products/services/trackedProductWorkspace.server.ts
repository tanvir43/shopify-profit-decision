import { costProfileService } from "~/modules/cost-profiles/services/costProfileService.server";
import type { authenticate } from "~/shopify.server";

import { hasProductCost } from "../lib/productStatus";
import type { TrackedProduct } from "../types";
import type { TrackedProductWorkspaceItem } from "../types/TrackedProductWorkspaceItem";
import {
  fetchProductsByIds,
  type ShopifyProductEnrichment,
} from "./shopifyProductsService.server";

type AdminGraphql = Awaited<ReturnType<typeof authenticate.admin>>["admin"];

export type TrackedProductWorkspaceData = {
  items: TrackedProductWorkspaceItem[];
  enrichmentError: string | null;
};

function formatTrackedAt(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function toWorkspaceItem(
  product: TrackedProduct,
  shopify: ShopifyProductEnrichment | undefined,
  enrichmentFailed: boolean,
  productHasCost: boolean,
): TrackedProductWorkspaceItem {
  const trackedAt = formatTrackedAt(product.trackedAt);

  if (shopify) {
    return {
      trackedProductId: product.id,
      shopifyProductId: product.shopifyProductId,
      title: shopify.title,
      status: shopify.status,
      imageUrl: shopify.imageUrl,
      imageAlt: shopify.imageAlt,
      trackedAt,
      hasProductCost: productHasCost,
    };
  }

  if (!enrichmentFailed) {
    return {
      trackedProductId: product.id,
      shopifyProductId: product.shopifyProductId,
      title: "Product unavailable",
      status: "UNAVAILABLE",
      imageUrl: null,
      imageAlt: null,
      trackedAt,
      hasProductCost: productHasCost,
    };
  }

  return {
    trackedProductId: product.id,
    shopifyProductId: product.shopifyProductId,
    title: product.shopifyProductId,
    status: "UNKNOWN",
    imageUrl: null,
    imageAlt: null,
    trackedAt,
    hasProductCost: productHasCost,
  };
}

async function loadProductCostFlags(
  shop: string,
  productIds: string[],
): Promise<Map<string, boolean>> {
  const flags = new Map<string, boolean>();

  if (productIds.length === 0) {
    return flags;
  }

  try {
    const profiles = await costProfileService.getDecisionProfiles(
      shop,
      productIds,
    );

    for (const profile of profiles) {
      flags.set(profile.productId, hasProductCost(profile.totalCost));
    }
  } catch {
    // Cost flags stay false — list still renders with "Add Product Cost First".
  }

  return flags;
}

/**
 * Enriches tracked product references with runtime Shopify product data
 * and local cost-profile readiness for list CTAs.
 * Shopify remains the source of truth for catalog fields — nothing is persisted.
 */
export async function loadTrackedProductWorkspace(
  admin: AdminGraphql,
  tracked: TrackedProduct[],
  shop: string,
): Promise<TrackedProductWorkspaceData> {
  const productIds = tracked.map((product) => product.shopifyProductId);
  const costFlagsPromise = loadProductCostFlags(shop, productIds);

  try {
    const [shopifyProducts, costFlags] = await Promise.all([
      fetchProductsByIds(admin, productIds),
      costFlagsPromise,
    ]);

    const items = tracked.map((product) =>
      toWorkspaceItem(
        product,
        shopifyProducts.get(product.shopifyProductId),
        false,
        costFlags.get(product.shopifyProductId) === true,
      ),
    );

    return { items, enrichmentError: null };
  } catch {
    const costFlags = await costFlagsPromise;
    const items = tracked.map((product) =>
      toWorkspaceItem(
        product,
        undefined,
        true,
        costFlags.get(product.shopifyProductId) === true,
      ),
    );

    return {
      items,
      enrichmentError:
        "We couldn't load product details from Shopify. Tracked products are shown with limited information.",
    };
  }
}
