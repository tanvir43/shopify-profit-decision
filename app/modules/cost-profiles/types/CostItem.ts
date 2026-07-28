import type { CostCategory } from "./CostCategory";
import type { CostUnit } from "./CostUnit";

/**
 * Domain cost line — a business fact, not a calculation.
 * `value` is a decimal string to avoid float precision loss across layers.
 */
export type CostItem = {
  id: string;
  name: string;
  value: string;
  unit: CostUnit;
  category: CostCategory;
  isActive: boolean;
  sortOrder: number;
  isSystem: boolean;
};
