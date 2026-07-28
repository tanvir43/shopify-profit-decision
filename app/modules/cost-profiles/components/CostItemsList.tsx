import type { CostCategory, CostUnit } from "../types";

export type CostItemListEntry = {
  id: string;
  name: string;
  category: CostCategory;
  unit: CostUnit;
  isActive: boolean;
};

type CostItemsListProps = {
  items: CostItemListEntry[];
};

const CATEGORY_LABELS: Record<CostCategory, string> = {
  PRODUCT: "Product",
  PACKAGING: "Packaging",
  SHIPPING: "Shipping",
  TRANSACTION: "Transaction",
  CUSTOM: "Custom",
};

const UNIT_LABELS: Record<CostUnit, string> = {
  FIXED: "Fixed",
  PERCENTAGE: "Percentage",
};

/**
 * Read-only cost item list. No inline actions or money values.
 */
export function CostItemsList({ items }: CostItemsListProps) {
  return (
    <s-stack direction="block" gap="small-200">
      {items.map((item) => (
        <s-box
          key={item.id}
          padding="base"
          background="base"
          border="base"
          borderRadius="base"
        >
          <s-stack
            direction="inline"
            gap="base"
            justifyContent="space-between"
            alignItems="center"
          >
            <s-stack direction="block" gap="small-100">
              <s-text type="strong">{item.name}</s-text>
              <s-text color="subdued">
                {CATEGORY_LABELS[item.category]} · {UNIT_LABELS[item.unit]}
              </s-text>
            </s-stack>
            {item.isActive ? (
              <s-badge tone="success">Active</s-badge>
            ) : (
              <s-badge tone="neutral">Inactive</s-badge>
            )}
          </s-stack>
        </s-box>
      ))}
    </s-stack>
  );
}
