import type { TrackedProduct } from "../types/TrackedProduct";

/**
 * Business orchestration for Tracked Products.
 *
 * Owns de-duplication and track/untrack use cases.
 * Does not know Prisma or Shopify Admin API.
 * No Cost Profile side effects (PP-0010).
 */
export interface TrackedProductService {
  /**
   * List tracked product references for the workspace.
   */
  listTrackedProducts(shopId: string): Promise<TrackedProduct[]>;

  /**
   * Load one tracked product reference by its primary key.
   * Returns null when the id does not exist for the shop.
   */
  getTrackedProduct(
    shopId: string,
    trackedProductId: string,
  ): Promise<TrackedProduct | null>;

  /**
   * Track Shopify products by reference.
   * Ignores duplicates (input + already tracked). Bulk inserts efficiently.
   * Returns newly tracked count.
   */
  trackProducts(shopId: string, productIds: string[]): Promise<number>;

  /**
   * Remove a tracked product reference. No Cost Profile changes.
   */
  untrackProduct(shopId: string, productId: string): Promise<void>;

  /**
   * Whether a Shopify product is already in the workspace.
   */
  isTracked(shopId: string, productId: string): Promise<boolean>;

  /**
   * Persist the merchant's selected Shopify variant for costing context.
   */
  selectVariant(
    shopId: string,
    trackedProductId: string,
    shopifyVariantId: string,
  ): Promise<TrackedProduct | null>;
}
