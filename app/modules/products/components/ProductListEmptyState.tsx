export function ProductListEmptyState() {
  return (
    <s-section>
      <s-grid gap="base" justifyItems="center" paddingBlock="large-400">
        <s-stack alignItems="center">
          <s-heading>No products yet</s-heading>
          <s-paragraph>
            Products from your Shopify catalog will appear here once synced.
          </s-paragraph>
        </s-stack>
      </s-grid>
    </s-section>
  );
}
