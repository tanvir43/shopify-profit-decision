import type { VariantContext } from "../lib/variantContext";

type VariantContextBannerProps = {
  productTitle: string;
  variant: VariantContext;
};

/**
 * Shows which Shopify variant the current costing context belongs to.
 */
export function VariantContextBanner({
  productTitle,
  variant,
}: VariantContextBannerProps) {
  if (!variant.title) {
    return null;
  }

  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <s-stack direction="block" gap="small-100">
        <s-text type="strong">{productTitle}</s-text>
        <s-text>Variant: {variant.title}</s-text>
      </s-stack>
    </s-box>
  );
}
