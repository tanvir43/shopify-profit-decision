import type { CostItemType } from "../types/CostItemType";
import type { CostProfile } from "../types";

export type SaveDetailedBreakdownInput = {
  shop: string;
  productId: string;
  /** ISO 4217 — used when creating a profile that does not exist yet. */
  currency: string;
  /** Raw form amounts keyed by CostItemType. Empty string = not provided. */
  amounts: Record<CostItemType, string>;
};

/**
 * Business orchestration for the Detailed Cost Builder flow (PP-0013).
 */
export interface DetailedSetupService {
  /**
   * Load the cost profile for Detailed Setup editing, if one exists.
   */
  getDetailedSetupProfile(
    shop: string,
    productId: string,
  ): Promise<CostProfile | null>;

  /**
   * Create/update CostItems from the breakdown form and set mode to DETAILED.
   * Sets totalCost to the sum of saved item amounts (Decision Workspace Product Cost).
   * Does not calculate margins or run the Decision Engine.
   */
  saveDetailedBreakdown(
    input: SaveDetailedBreakdownInput,
  ): Promise<CostProfile>;
}
