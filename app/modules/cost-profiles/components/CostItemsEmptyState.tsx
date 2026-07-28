/**
 * First-time merchant empty state for Cost Items.
 * Copy focuses on business outcome, not accounting language.
 */
export function CostItemsEmptyState() {
  return (
    <s-section accessibilityLabel="Empty cost items">
      <s-grid gap="base" justifyItems="center" paddingBlock="large-400">
        <s-grid justifyItems="center" maxInlineSize="450px" gap="base">
          <s-stack alignItems="center" gap="small-200">
            <s-heading>No costs added yet</s-heading>
            <s-paragraph>
              Start by adding the costs involved in selling this product.
              ProfitPilot will use these later to help you make smarter pricing
              decisions.
            </s-paragraph>
          </s-stack>
          <s-button-group>
            <s-button slot="primary-action" variant="primary">
              Add First Cost
            </s-button>
          </s-button-group>
        </s-grid>
      </s-grid>
    </s-section>
  );
}
