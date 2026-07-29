import { trackedProductHref } from "../lib/productStatus";

type TrackedProductRowProps = {
  id: string;
  shopifyProductId: string;
  trackedAt: string;
};

/**
 * Architecture-first row: Shopify product ID + tracked date only.
 * Title/image enrichment is intentionally deferred.
 */
export function TrackedProductRow({
  id,
  shopifyProductId,
  trackedAt,
}: TrackedProductRowProps) {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <s-stack
        direction="inline"
        gap="base"
        alignItems="center"
        justifyContent="space-between"
      >
        <s-stack direction="block" gap="small-100">
          <s-text type="strong">{shopifyProductId}</s-text>
          <s-text color="subdued">Tracked {trackedAt}</s-text>
        </s-stack>
        <s-button href={trackedProductHref(id)} variant="secondary">
          Open
        </s-button>
      </s-stack>
    </s-box>
  );
}
