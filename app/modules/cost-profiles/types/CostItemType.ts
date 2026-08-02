import type { CostCategory } from "./CostCategory";

/**
 * Merchant-facing cost line types for the Detailed Cost Builder (PP-0013).
 * Persisted via CostCategory (ADR-004) — see costItemTypeToCategory.
 */
export const COST_ITEM_TYPES = [
  "PURCHASE",
  "PACKAGING",
  "SHIPPING",
  "PAYMENT_FEES",
  "OTHER",
] as const;

export type CostItemType = (typeof COST_ITEM_TYPES)[number];

/** Display labels — plain language, no accounting jargon. */
export const COST_ITEM_TYPE_LABELS: Record<CostItemType, string> = {
  PURCHASE: "Purchase",
  PACKAGING: "Packaging",
  SHIPPING: "Shipping",
  PAYMENT_FEES: "Payment fees",
  OTHER: "Other",
};

/** Stable row order for the Detailed Setup form. */
export const COST_ITEM_TYPE_SORT_ORDER: Record<CostItemType, number> = {
  PURCHASE: 0,
  PACKAGING: 1,
  SHIPPING: 2,
  PAYMENT_FEES: 3,
  OTHER: 4,
};

export function costItemTypeToCategory(type: CostItemType): CostCategory {
  switch (type) {
    case "PURCHASE":
      return "PRODUCT";
    case "PACKAGING":
      return "PACKAGING";
    case "SHIPPING":
      return "SHIPPING";
    case "PAYMENT_FEES":
      return "TRANSACTION";
    case "OTHER":
      return "CUSTOM";
  }
}

export function categoryToCostItemType(category: CostCategory): CostItemType {
  switch (category) {
    case "PRODUCT":
      return "PURCHASE";
    case "PACKAGING":
      return "PACKAGING";
    case "SHIPPING":
      return "SHIPPING";
    case "TRANSACTION":
      return "PAYMENT_FEES";
    case "CUSTOM":
      return "OTHER";
  }
}
