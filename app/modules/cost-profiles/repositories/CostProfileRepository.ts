import type { CostProfile, CostProfilePersist } from "../types";

/**
 * Persistence port for the CostProfile aggregate.
 *
 * Deliberately not CRUD: methods map to business access patterns.
 * Shop is required on every read/write for multi-tenant isolation.
 * CostItems are never addressed outside the parent aggregate.
 */
export interface CostProfileRepository {
  /**
   * Load one profile by its natural key (shop + Shopify productId), including items.
   * Why: @@unique([shop, productId]) is the primary access path for UI and decisions.
   * Consumers: Cost Profile UI, Pricing, Safe Discount, Break-even, Bundle, AI Advisor
   *            (via CostProfileService — not called directly by feature modules).
   */
  findByProduct(
    shop: string,
    productId: string,
  ): Promise<CostProfile | null>;

  /**
   * Batch load by natural keys. Missing products yield no entry (not an error).
   * Why: Bundle Pricing and multi-product advisors must avoid N+1; product lists
   *      may later badge "has cost profile" without per-row queries.
   * Consumers: Bundle Pricing, AI Advisor (multi-product), future product overlays
   */
  findByProducts(
    shop: string,
    productIds: string[],
  ): Promise<CostProfile[]>;

  /**
   * Upsert the full aggregate (profile meta + item set) in one persistence boundary.
   * Why: Items have no independent lifecycle; replace/create/update semantics stay
   *      transactional and owned by the aggregate root.
   * Consumers: CostProfileService write paths only (ensure, updateMeta, replaceItems)
   */
  save(profile: CostProfilePersist): Promise<CostProfile>;
}
