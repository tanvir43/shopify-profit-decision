import type { CostItem } from "./CostItem";
import type { CostProfileMode } from "./CostProfileMode";

/**
 * Aggregate root: one cost structure per Shopify product within a shop.
 * Items are owned by the profile; consumers never persist items independently.
 */
export type CostProfile = {
  id: string;
  shop: string;
  productId: string;
  currency: string;
  mode: CostProfileMode;
  totalCost: string | null;
  sellingPrice: string | null;
  notes: string | null;
  items: CostItem[];
  createdAt: Date;
  updatedAt: Date;
};
