import type { TrackedProduct as PrismaTrackedProduct } from "@prisma/client";

import type { TrackedProduct } from "../types/TrackedProduct";

/**
 * Prisma ↔ domain conversion for TrackedProduct.
 * Field names align 1:1 today; mapper isolates any future storage drift.
 */
export function toTrackedProductDomain(
  row: PrismaTrackedProduct,
): TrackedProduct {
  return {
    id: row.id,
    shopId: row.shopId,
    shopifyProductId: row.shopifyProductId,
    selectedShopifyVariantId: row.selectedShopifyVariantId,
    trackedAt: row.trackedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
