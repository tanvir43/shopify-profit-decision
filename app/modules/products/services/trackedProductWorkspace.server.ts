import type { authenticate } from "~/shopify.server";

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
  };
}

/**
 * Enriches tracked product references with runtime Shopify product data.
 * Shopify remains the source of truth — nothing is persisted.
 */
export async function loadTrackedProductWorkspace(
  admin: AdminGraphql,
  tracked: TrackedProduct[],
): Promise<TrackedProductWorkspaceData> {
  const productIds = tracked.map((product) => product.shopifyProductId);

  try {
    const shopifyProducts = await fetchProductsByIds(admin, productIds);
    const items = tracked.map((product) =>
      toWorkspaceItem(
        product,
        shopifyProducts.get(product.shopifyProductId),
        false,
      ),
    );

    return { items, enrichmentError: null };
  } catch {
    const items = tracked.map((product) =>
      toWorkspaceItem(product, undefined, true),
    );

    return {
      items,
      enrichmentError:
        "We couldn't load product details from Shopify. Tracked products are shown with limited information.",
    };
  }
}
