import type { PrismaClient } from "@prisma/client";

/**
 * Atomically stop tracking a Shopify product for a shop.
 *
 * Deletes all CostProfiles for (shop, productId) — CostItems cascade —
 * and the matching TrackedProduct row. Both mutations succeed or neither
 * persists. `deleteMany` makes repeated calls safe no-ops.
 */
export async function stopTrackingProduct(
  prisma: PrismaClient,
  shopId: string,
  shopifyProductId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // CostItem rows cascade when CostProfile is deleted.
    await tx.costProfile.deleteMany({
      where: {
        shop: shopId,
        productId: shopifyProductId,
      },
    });
    await tx.trackedProduct.deleteMany({
      where: {
        shopId,
        shopifyProductId,
      },
    });
  });
}
