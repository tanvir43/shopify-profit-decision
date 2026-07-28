export function ProductListEmptyState() {
  return (
    <s-section accessibilityLabel="No products">
      <s-grid gap="base" justifyItems="center" paddingBlock="large-400">
        <s-grid justifyItems="center" maxInlineSize="450px" gap="base">
          <s-stack alignItems="center" gap="small-200">
            <s-heading>No products yet</s-heading>
            <s-paragraph>
              Add products in your Shopify admin, then return here to choose
              which one to optimize.
            </s-paragraph>
          </s-stack>
        </s-grid>
      </s-grid>
    </s-section>
  );
}
