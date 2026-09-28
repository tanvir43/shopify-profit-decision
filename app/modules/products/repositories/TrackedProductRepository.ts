import type { PlanEntitlement } from "~/lib/planEntitlements.server";

import type { TrackedProduct } from "../types/TrackedProduct";

/**
 * Persistence port for TrackedProduct references.
 *
 * Intent-named methods only (ADR-003). Shop is required on every call.
 * Does not call Shopify — database access only.
 */
export interface TrackedProductRepository {
  /**
   * List all tracked product references for a shop, newest first.
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
   * Bulk insert tracked references. Skips rows that already exist
   * (unique on shopId + shopifyProductId). Returns newly inserted count.
   *
   * When `maxTrackedProducts` is set, the insert runs in a transaction and
   * rejects the whole batch if capacity would be exceeded (no partial inserts).
   */
  trackProducts(
    shopId: string,
    productIds: string[],
    options?: {
      maxTrackedProducts: number | null;
      entitlement?: PlanEntitlement;
    },
  ): Promise<number>;

  /**
   * Remove one tracked reference by natural key. No-op if not tracked.
   */
  untrackProduct(shopId: string, productId: string): Promise<void>;

  /**
   * Whether this Shopify product is already tracked for the shop.
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
