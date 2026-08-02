import type { CostProfile } from "../types";

/**
 * Selling price entry — collect and persist merchant selling price only.
 */
export interface SellingPriceService {
  /**
   * Load the cost profile for the selling price page, if one exists.
   */
  getSellingPriceProfile(
    shop: string,
    productId: string,
  ): Promise<CostProfile | null>;

  /**
   * Persist sellingPrice on an existing CostProfile.
   * Does not modify totalCost or items.
   */
  saveSellingPrice(
    shop: string,
    productId: string,
    sellingPriceRaw: string,
  ): Promise<CostProfile>;
}
