type TrackedProductsEmptyStateProps = {
  onAddProducts: () => void;
  addProductsDisabled?: boolean;
};

/**
 * Empty workspace when the merchant has not tracked any products yet.
 */
export function TrackedProductsEmptyState({
  onAddProducts,
  addProductsDisabled = false,
}: TrackedProductsEmptyStateProps) {
  return (
    <s-section accessibilityLabel="No tracked products">
      <s-grid gap="base" justifyItems="center" paddingBlock="large-400">
        <s-grid justifyItems="center" maxInlineSize="450px" gap="base">
          <s-stack alignItems="center" gap="small-200">
            <s-heading>No Tracked Products added yet</s-heading>
            <s-paragraph>
              Choose the Shopify products you want to optimize with ProfitPilot.
            </s-paragraph>
          </s-stack>
          <s-button-group>
            <s-button
              slot="primary-action"
              variant="primary"
              onClick={onAddProducts}
              disabled={addProductsDisabled}
            >
              Add Products
            </s-button>
          </s-button-group>
        </s-grid>
      </s-grid>
    </s-section>
  );
}
