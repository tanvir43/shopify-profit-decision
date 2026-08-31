import type { PrismaClient } from "@prisma/client";

import { toTrackedProductDomain } from "../mappers/trackedProductMapper";
import type { TrackedProduct } from "../types/TrackedProduct";
import type { TrackedProductRepository } from "./TrackedProductRepository";

/**
 * Prisma implementation of TrackedProductRepository.
 * Database only — no Shopify Admin API calls.
 */
export function createPrismaTrackedProductRepository(
  prisma: PrismaClient,
): TrackedProductRepository {
  return {
    async listTrackedProducts(shopId: string): Promise<TrackedProduct[]> {
      const rows = await prisma.trackedProduct.findMany({
        where: { shopId },
        orderBy: { trackedAt: "desc" },
      });

      return rows.map(toTrackedProductDomain);
    },

    async getTrackedProduct(
      shopId: string,
      trackedProductId: string,
    ): Promise<TrackedProduct | null> {
      const row = await prisma.trackedProduct.findFirst({
        where: {
          id: trackedProductId,
          shopId,
        },
      });

      return row ? toTrackedProductDomain(row) : null;
    },

    async trackProducts(
      shopId: string,
      productIds: string[],
    ): Promise<number> {
      if (productIds.length === 0) {
        return 0;
      }

      const result = await prisma.trackedProduct.createMany({
        data: productIds.map((shopifyProductId) => ({
          shopId,
          shopifyProductId,
        })),
        skipDuplicates: true,
      });

      return result.count;
    },

    async untrackProduct(shopId: string, productId: string): Promise<void> {
      await prisma.trackedProduct.deleteMany({
        where: {
          shopId,
          shopifyProductId: productId,
        },
      });
    },

    async isTracked(shopId: string, productId: string): Promise<boolean> {
      const row = await prisma.trackedProduct.findUnique({
        where: {
          shopId_shopifyProductId: {
            shopId,
            shopifyProductId: productId,
          },
        },
        select: { id: true },
      });

      return row !== null;
    },

    async selectVariant(
      shopId: string,
      trackedProductId: string,
      shopifyVariantId: string,
    ): Promise<TrackedProduct | null> {
      const existing = await prisma.trackedProduct.findFirst({
        where: {
          id: trackedProductId,
          shopId,
        },
      });

      if (!existing) {
        return null;
      }

      const row = await prisma.trackedProduct.update({
        where: { id: existing.id },
        data: { selectedShopifyVariantId: shopifyVariantId },
      });

      return toTrackedProductDomain(row);
    },
  };
}
