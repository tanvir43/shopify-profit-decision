import { useCallback, useState } from "react";
import { useFetcher } from "react-router";

import { PageLayout } from "~/components/PageLayout";
import { formatCurrencyAmount } from "~/modules/cost-profiles/lib/formatCurrency";

import { trackedProductsListHref } from "./lib/productStatus";
import type { VariantSelectionOption } from "./lib/resolveProductDetailView";

export type ProductVariantSelectionPageData = {
  trackedProductId: string;
  productTitle: string;
  imageUrl: string | null;
  imageAlt: string | null;
  currency: string;
  variants: VariantSelectionOption[];
};

export type VariantSelectionActionData =
  | { ok: true }
  | { ok: false; error: string };

type ProductVariantSelectionPageProps = {
  data: ProductVariantSelectionPageData;
};

/**
 * Variant selection step before cost setup for multi-variant Shopify products.
 */
export function ProductVariantSelectionPage({
  data,
}: ProductVariantSelectionPageProps) {
  const {
    trackedProductId,
    productTitle,
    imageUrl,
    imageAlt,
    currency,
    variants,
  } = data;
  const fetcher = useFetcher<VariantSelectionActionData>();
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null,
  );
  const [fieldError, setFieldError] = useState<string | null>(null);

  const isSubmitting = fetcher.state !== "idle";
  const backHref = trackedProductsListHref(trackedProductId);
  const thumbnailAlt =
    imageUrl && imageAlt
      ? imageAlt
      : imageUrl
        ? `Photo of ${productTitle}`
        : "";

  const handleContinue = useCallback(() => {
    if (!selectedVariantId) {
      setFieldError("Select a variant to continue.");
      return;
    }

    setFieldError(null);
    fetcher.submit(
      {
        intent: "select-variant",
        shopifyVariantId: selectedVariantId,
      },
      { method: "post" },
    );
  }, [fetcher, selectedVariantId]);

  return (
    <PageLayout
      title="Select a variant"
      breadcrumbActions={
        <s-link slot="breadcrumb-actions" href={backHref}>
          Back
        </s-link>
      }
    >
      <s-stack direction="block" gap="large-100">
        <s-stack direction="inline" gap="base" alignItems="center">
          {imageUrl ? (
            <s-thumbnail src={imageUrl} alt={thumbnailAlt} size="small" />
          ) : (
            <s-thumbnail alt="" size="small" />
          )}
          <s-stack direction="block" gap="small-100">
            <s-text type="strong">{productTitle}</s-text>
            <s-text color="subdued">
              Choose the variant you want to cost and simulate.
            </s-text>
          </s-stack>
        </s-stack>

        {fetcher.data != null && !fetcher.data.ok ? (
          <s-banner tone="critical" heading="Could not continue">
            <p>{fetcher.data.error}</p>
          </s-banner>
        ) : null}

        {fieldError ? (
          <s-banner tone="critical" heading="Selection required">
            <p>{fieldError}</p>
          </s-banner>
        ) : null}

        <s-stack direction="block" gap="small-100">
          {variants.map((variant) => {
            const selected = selectedVariantId === variant.id;

            return (
              <s-box
                key={variant.id}
                padding="base"
                borderWidth="base"
                borderRadius="base"
              >
                <s-stack
                  direction="inline"
                  gap="base"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <s-stack direction="block" gap="small-100">
                    <s-text type="strong">{variant.title}</s-text>
                    <s-text color="subdued">
                      Shopify price: {formatCurrencyAmount(variant.price, currency)}
                    </s-text>
                    {variant.hasProductCost ? (
                      <s-badge tone="success">Cost saved</s-badge>
                    ) : null}
                  </s-stack>
                  <s-button
                    variant={selected ? "primary" : "secondary"}
                    disabled={isSubmitting}
                    onClick={() => {
                      setSelectedVariantId(variant.id);
                      setFieldError(null);
                    }}
                  >
                    {selected ? "Selected" : "Select"}
                  </s-button>
                </s-stack>
              </s-box>
            );
          })}
        </s-stack>

        <s-stack direction="inline" gap="base">
          <s-button
            variant="primary"
            disabled={isSubmitting || selectedVariantId == null}
            loading={isSubmitting}
            onClick={handleContinue}
          >
            Continue
          </s-button>
        </s-stack>
      </s-stack>
    </PageLayout>
  );
}
