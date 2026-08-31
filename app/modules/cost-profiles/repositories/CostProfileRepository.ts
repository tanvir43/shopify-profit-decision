import type {
  CostProfile,
  CostProfilePersist,
  CreateQuickStartCostProfileInput,
} from "../types";

/**
 * Persistence port for the CostProfile aggregate.
 *
 * Deliberately not CRUD: methods map to business access patterns.
 * Shop is required on every read/write for multi-tenant isolation.
 * CostItems are never addressed outside the parent aggregate.
 */
export interface CostProfileRepository {
  /**
   * Load the product-level profile (legacy / no-variant products).
   */
  findByProduct(
    shop: string,
    productId: string,
  ): Promise<CostProfile | null>;

  /**
   * Load one profile by shop + product + variant scope.
   */
  findByProductAndVariant(
    shop: string,
    productId: string,
    shopifyVariantId: string,
  ): Promise<CostProfile | null>;

  /**
   * Load all profiles for one Shopify product (all variant scopes).
   */
  findAllForProduct(
    shop: string,
    productId: string,
  ): Promise<CostProfile[]>;

  /**
   * Batch load by natural keys. Missing products yield no entry (not an error).
   */
  findByProducts(
    shop: string,
    productIds: string[],
  ): Promise<CostProfile[]>;

  /**
   * Upsert the full aggregate (profile meta + item set) in one persistence boundary.
   */
  save(profile: CostProfilePersist): Promise<CostProfile>;

  /**
   * Load one profile by shop + Shopify productId + variant scope.
   */
  getCostProfileByTrackedProductId(
    shop: string,
    productId: string,
    shopifyVariantId?: string,
  ): Promise<CostProfile | null>;

  /**
   * Insert a Quick Start profile. Caller ensures no duplicate exists.
   */
  createQuickStartCostProfile(
    input: CreateQuickStartCostProfileInput,
  ): Promise<CostProfile>;

  /**
   * Update totalCost on an existing profile. Repository-only — no validation.
   */
  updateQuickStartCost(
    shop: string,
    productId: string,
    shopifyVariantId: string,
    totalCost: string,
  ): Promise<CostProfile>;

  /**
   * Update sellingPrice on an existing profile. Repository-only — no validation.
   */
  updateSellingPrice(
    shop: string,
    productId: string,
    shopifyVariantId: string,
    sellingPrice: string,
  ): Promise<CostProfile>;
}
