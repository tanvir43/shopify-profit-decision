import type { TrackedProductRepository } from "../repositories/TrackedProductRepository";
import type { TrackedProduct } from "../types/TrackedProduct";
import type { TrackedProductService } from "./TrackedProductService";

/**
 * Application service for Tracked Product use cases.
 *
 * Orchestrates repository access and de-duplication.
 * Does not own Prisma, HTTP, UI, Shopify API, or Cost Profiles.
 */
export function createTrackedProductService(
  repository: TrackedProductRepository,
): TrackedProductService {
  return {
    async listTrackedProducts(shopId: string): Promise<TrackedProduct[]> {
      return repository.listTrackedProducts(shopId);
    },

    async getTrackedProduct(
      shopId: string,
      trackedProductId: string,
    ): Promise<TrackedProduct | null> {
      const id = trackedProductId.trim();
      if (id.length === 0) {
        return null;
      }

      return repository.getTrackedProduct(shopId, id);
    },

    async trackProducts(
      shopId: string,
      productIds: string[],
    ): Promise<number> {
      // Ignore empty / whitespace ids and de-dupe the input batch.
      const uniqueIds = [
        ...new Set(
          productIds.map((id) => id.trim()).filter((id) => id.length > 0),
        ),
      ];

      if (uniqueIds.length === 0) {
        return 0;
      }

      // Repository createMany(skipDuplicates) ignores already-tracked rows.
      return repository.trackProducts(shopId, uniqueIds);
    },

    async untrackProduct(shopId: string, productId: string): Promise<void> {
      await repository.untrackProduct(shopId, productId);
    },

    async isTracked(shopId: string, productId: string): Promise<boolean> {
      return repository.isTracked(shopId, productId);
    },
  };
}
