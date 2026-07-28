import type { CostItem } from "./CostItem";

/**
 * Aggregate root: one cost structure per Shopify product within a shop.
 * Items are owned by the profile; consumers never persist items independently.
 */
export type CostProfile = {
  id: string;
  shop: string;
  productId: string;
  currency: string;
  notes: string | null;
  items: CostItem[];
  createdAt: Date;
  updatedAt: Date;
};
