import type { PrismaClient } from "@prisma/client";

import {
  buildTrackedProductLimitError,
  canAddTrackedProducts,
  countNewUniqueProductIds,
  TrackedProductLimitExceededError,
} from "~/lib/trackedProductCapacity";
import type { PlanEntitlement } from "~/lib/planEntitlements.server";

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
      options?: {
        maxTrackedProducts: number | null;
        entitlement?: PlanEntitlement;
      },
    ): Promise<number> {
      if (productIds.length === 0) {
        return 0;
      }

      const uniqueIds = [
        ...new Set(
          productIds.map((id) => id.trim()).filter((id) => id.length > 0),
        ),
      ];

      if (uniqueIds.length === 0) {
        return 0;
      }

      const maxTrackedProducts = options?.maxTrackedProducts ?? null;

      if (maxTrackedProducts === null) {
        const result = await prisma.trackedProduct.createMany({
          data: uniqueIds.map((shopifyProductId) => ({
            shopId,
            shopifyProductId,
          })),
          skipDuplicates: true,
        });

        return result.count;
      }

      const entitlement = options?.entitlement;

      return prisma.$transaction(
        async (tx) => {
          const existingRows = await tx.trackedProduct.findMany({
            where: {
              shopId,
              shopifyProductId: { in: uniqueIds },
            },
            select: { shopifyProductId: true },
          });

          const alreadyTracked = new Set(
            existingRows.map((row) => row.shopifyProductId),
          );
          const additional = countNewUniqueProductIds(
            uniqueIds,
            alreadyTracked,
          );

          if (additional === 0) {
            return 0;
          }

          const currentCount = await tx.trackedProduct.count({
            where: { shopId },
          });

          const allowed = canAddTrackedProducts(
            { currentCount, limit: maxTrackedProducts },
            additional,
          );

          if (!allowed) {
            if (!entitlement) {
              throw new TrackedProductLimitExceededError(
                "Your plan does not allow adding more tracked products.",
              );
            }

            throw buildTrackedProductLimitError(
              entitlement,
              currentCount,
              additional,
            );
          }

          const newIds = uniqueIds.filter((id) => !alreadyTracked.has(id));

          const result = await tx.trackedProduct.createMany({
            data: newIds.map((shopifyProductId) => ({
              shopId,
              shopifyProductId,
            })),
            skipDuplicates: true,
          });

          return result.count;
        },
        {
          isolationLevel: "Serializable",
        },
      );
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
