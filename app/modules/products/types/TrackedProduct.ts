/**
 * Domain type for a merchant-tracked Shopify product reference.
 * Shopify remains the source of truth — no mirrored catalog fields.
 */
export type TrackedProduct = {
  id: string;
  shopId: string;
  shopifyProductId: string;
  trackedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};
