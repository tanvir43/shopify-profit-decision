/**
 * System taxonomy for cost lines. Multiple items may share one category.
 * CUSTOM is the escape hatch until a first-class category is justified.
 */
export type CostCategory =
  | "PRODUCT"
  | "PACKAGING"
  | "SHIPPING"
  | "TRANSACTION"
  | "CUSTOM";
