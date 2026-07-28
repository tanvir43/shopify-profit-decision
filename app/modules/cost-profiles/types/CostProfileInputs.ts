import type { CostCategory } from "./CostCategory";
import type { CostUnit } from "./CostUnit";

export type EnsureCostProfileInput = {
  shop: string;
  productId: string;
  /** ISO 4217 — required when creating; ignored when profile already exists. */
  currency: string;
};

export type UpdateCostProfileMetaInput = {
  currency?: string;
  notes?: string | null;
};

/**
 * Item payload for replaceItems.
 * Omit `id` for new lines; include `id` to retain identity across a replace.
 * Lines absent from the array are removed (service enforces isSystem rules).
 */
export type CostItemInput = {
  id?: string;
  name: string;
  value: string;
  unit: CostUnit;
  category: CostCategory;
  isActive: boolean;
  sortOrder: number;
  isSystem?: boolean;
};

/**
 * Persistence-shaped aggregate for repository.save.
 * Identity is shop + productId (unique). `id` present means update.
 */
export type CostProfilePersist = {
  id?: string;
  shop: string;
  productId: string;
  currency: string;
  notes: string | null;
  items: CostItemInput[];
};
