import {
  costProfileHref,
  formatProductStatus,
} from "../lib/productStatus";
import type { ProductSummary } from "../types";

type ProductRowProps = {
  product: ProductSummary;
};

export function ProductRow({ product }: ProductRowProps) {
  const { label, tone } = formatProductStatus(product.status);
  const imageAlt = product.featuredImageUrl
    ? `Photo of ${product.title}`
    : "";

  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <s-stack
        direction="inline"
        gap="base"
        alignItems="center"
        justifyContent="space-between"
      >
        <s-stack direction="inline" gap="base" alignItems="center">
          {product.featuredImageUrl ? (
            <s-thumbnail
              src={product.featuredImageUrl}
              alt={imageAlt}
              size="small"
            />
          ) : (
            <s-thumbnail alt="" size="small" />
          )}
          <s-stack direction="block" gap="small-100">
            <s-text type="strong">{product.title}</s-text>
            <s-badge tone={tone}>{label}</s-badge>
          </s-stack>
        </s-stack>
        <s-button
          href={costProfileHref(product.id)}
          variant="secondary"
        >
          Open Cost Profile
        </s-button>
      </s-stack>
    </s-box>
  );
}
