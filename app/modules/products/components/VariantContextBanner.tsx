import type { VariantContext } from "../lib/variantContext";
import { formatCurrencyAmount } from "~/modules/cost-profiles/lib/formatCurrency";

type VariantContextBannerProps = {
  productTitle: string;
  variant: VariantContext;
  currency: string;
};

/**
 * Shows which Shopify variant the current costing context belongs to.
 */
export function VariantContextBanner({
  productTitle,
  variant,
  currency,
}: VariantContextBannerProps) {
  if (!variant.title) {
    return null;
  }

  const priceLabel =
    variant.price != null
      ? formatCurrencyAmount(variant.price, currency)
      : null;

  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <s-stack direction="block" gap="small-100">
        <s-text color="subdued">Variant context</s-text>
        <s-text type="strong">{productTitle}</s-text>
        <s-text>{variant.title}</s-text>
        {priceLabel ? (
          <s-text color="subdued">Shopify price: {priceLabel}</s-text>
        ) : null}
      </s-stack>
    </s-box>
  );
}
