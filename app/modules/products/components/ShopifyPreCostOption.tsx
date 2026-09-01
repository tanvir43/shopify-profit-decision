import { useCallback, useEffect, useRef } from "react";
import { useFetcher, useRevalidator } from "react-router";

import { formatCurrencyAmount } from "~/modules/cost-profiles/lib/formatCurrency";

import { trackedProductHref } from "../lib/productStatus";
import type { QuickStartActionData } from "../QuickStartPage";

type ShopifyPreCostOptionProps = {
  trackedProductId: string;
  currency: string;
  totalCost: string;
};

/**
 * Lets merchants adopt the unit cost already stored in Shopify.
 */
export function ShopifyPreCostOption({
  trackedProductId,
  currency,
  totalCost,
}: ShopifyPreCostOptionProps) {
  const fetcher = useFetcher<QuickStartActionData>();
  const revalidator = useRevalidator();
  const handledSubmission = useRef(false);

  const isSaving = fetcher.state !== "idle";
  const costDisplay = formatCurrencyAmount(totalCost, currency);
  const submitError =
    fetcher.data != null && !fetcher.data.ok ? fetcher.data.error : null;

  useEffect(() => {
    if (fetcher.state === "submitting") {
      handledSubmission.current = false;
      return;
    }

    if (
      fetcher.state === "idle" &&
      fetcher.data != null &&
      !handledSubmission.current
    ) {
      handledSubmission.current = true;

      if (fetcher.data.ok) {
        revalidator.revalidate();
      }
    }
  }, [fetcher.state, fetcher.data, revalidator]);

  const handleUsePreCost = useCallback(() => {
    if (isSaving) {
      return;
    }

    handledSubmission.current = false;

    fetcher.submit(
      { intent: "use-shopify-pre-cost" },
      {
        method: "post",
        action: trackedProductHref(trackedProductId),
      },
    );
  }, [fetcher, isSaving, trackedProductId]);

  return (
    <s-box padding="large-100" borderWidth="base" borderRadius="base">
      <s-stack direction="block" gap="base">
        <s-stack direction="block" gap="small-200">
          <s-heading>Use your Shopify cost</s-heading>
          <s-paragraph>
            We found a product cost already saved in Shopify for this product.
          </s-paragraph>
          <s-text type="strong">Shopify cost: {costDisplay}</s-text>
        </s-stack>

        {submitError ? (
          <s-banner tone="critical" heading="Could not save">
            <s-text>{submitError}</s-text>
          </s-banner>
        ) : null}

        <s-button
          variant="primary"
          disabled={isSaving}
          loading={isSaving}
          onClick={handleUsePreCost}
        >
          Use this cost &amp; Continue
        </s-button>
      </s-stack>
    </s-box>
  );
}
