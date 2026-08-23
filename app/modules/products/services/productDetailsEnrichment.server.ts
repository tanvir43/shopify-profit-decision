import type { authenticate } from "~/shopify.server";

import {
  fetchProductsByIds,
  type ShopifyProductEnrichment,
} from "./shopifyProductsService.server";

type AdminGraphql = Awaited<ReturnType<typeof authenticate.admin>>["admin"];

export type ProductDetailsEnrichment = {
  productTitle: string;
  productStatus: string;
  imageUrl: string | null;
  imageAlt: string | null;
};

/**
 * Deferred Shopify enrichment for a single tracked product.
 * Keeps the Decision Workspace loader on the DB-only critical path.
 */
export async function loadProductDetailsEnrichment(
  admin: AdminGraphql,
  shopifyProductId: string,
): Promise<ProductDetailsEnrichment> {
  try {
    const products = await fetchProductsByIds(admin, [shopifyProductId]);
    const enrichment = products.get(shopifyProductId);

    if (enrichment) {
      return toProductDetailsEnrichment(enrichment);
    }

    return {
      productTitle: "Product unavailable",
      productStatus: "UNAVAILABLE",
      imageUrl: null,
      imageAlt: null,
    };
  } catch {
    return {
      productTitle: shopifyProductId,
      productStatus: "UNKNOWN",
      imageUrl: null,
      imageAlt: null,
    };
  }
}

function toProductDetailsEnrichment(
  enrichment: ShopifyProductEnrichment,
): ProductDetailsEnrichment {
  return {
    productTitle: enrichment.title,
    productStatus: enrichment.status,
    imageUrl: enrichment.imageUrl,
    imageAlt: enrichment.imageAlt,
  };
}
