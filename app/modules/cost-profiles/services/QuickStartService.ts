import type { CostProfile, OpenQuickStartInput } from "../types";

/**
 * Business orchestration for the Quick Start cost entry flow (PP-0012).
 */
export interface QuickStartService {
  /**
   * Open Quick Start: return an existing profile or create one in QUICK_START mode.
   */
  openQuickStart(input: OpenQuickStartInput): Promise<CostProfile>;

  /**
   * Validate and persist totalCost for a Quick Start profile.
   */
  saveQuickStartCost(
    shop: string,
    productId: string,
    totalCostRaw: string,
  ): Promise<CostProfile>;

  /**
   * Load a Quick Start profile if one exists for this product.
   */
  getQuickStartProfile(
    shop: string,
    productId: string,
  ): Promise<CostProfile | null>;
}
