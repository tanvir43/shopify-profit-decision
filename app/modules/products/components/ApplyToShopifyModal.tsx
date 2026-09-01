import { useCallback, useEffect, useRef } from "react";
import { useFetcher, useRevalidator } from "react-router";

import { formatCurrencyAmount } from "~/modules/cost-profiles/lib/formatCurrency";

import { trackedProductHref } from "../lib/productStatus";
import type { ApplyToShopifyActionData } from "../services/applyToShopify.server";
import type { VariantContext } from "../lib/variantContext";

export const APPLY_TO_SHOPIFY_MODAL_ID = "apply-to-shopify-modal";

type ApplyToShopifyModalProps = {
  trackedProductId: string;
  productTitle: string;
  variant: VariantContext;
  currency: string;
  evaluatedSellingPrice: string;
  totalCost: string;
  onSuccess?: (message: string) => void;
};

type ModalElement = HTMLElement & {
  showOverlay: () => void;
  hideOverlay: () => void;
};

function formatShopifyPriceDisplay(
  price: string | null,
  currency: string,
): string {
  if (price == null || price.trim() === "") {
    return "—";
  }

  return formatCurrencyAmount(price, currency);
}

/**
 * Confirmation modal before syncing ProfitPilot selling price and cost to Shopify.
 */
export function ApplyToShopifyModal({
  trackedProductId,
  productTitle,
  variant,
  currency,
  evaluatedSellingPrice,
  totalCost,
  onSuccess,
}: ApplyToShopifyModalProps) {
  const fetcher = useFetcher<ApplyToShopifyActionData>();
  const revalidator = useRevalidator();
  const modalRef = useRef<ModalElement | null>(null);
  const handledSubmission = useRef(false);

  const isSubmitting = fetcher.state !== "idle";

  const currentShopifyPriceDisplay = formatShopifyPriceDisplay(
    variant.price,
    currency,
  );
  const newPriceDisplay = formatCurrencyAmount(evaluatedSellingPrice, currency);
  const costDisplay = formatCurrencyAmount(totalCost, currency);

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
        onSuccess?.(fetcher.data.message);
        revalidator.revalidate();
        modalRef.current?.hideOverlay();
      }
    }
  }, [fetcher.state, fetcher.data, onSuccess, revalidator]);

  const handleCancel = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    modalRef.current?.hideOverlay();
  }, [isSubmitting]);

  const handleConfirm = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    handledSubmission.current = false;

    fetcher.submit(
      { intent: "apply-to-shopify", sellingPrice: evaluatedSellingPrice },
      {
        method: "post",
        action: trackedProductHref(trackedProductId),
      },
    );
  }, [evaluatedSellingPrice, fetcher, isSubmitting, trackedProductId]);

  const submitError =
    fetcher.data != null && !fetcher.data.ok ? fetcher.data.error : null;

  return (
    <s-modal
      id={APPLY_TO_SHOPIFY_MODAL_ID}
      heading="Apply to Shopify"
      ref={modalRef as never}
    >
      <s-stack direction="block" gap="base">
        {submitError ? (
          <s-banner tone="critical" heading="Could not update Shopify">
            <p>{submitError}</p>
          </s-banner>
        ) : null}

        <s-paragraph>
          Confirm the values below. Only the selected Shopify variant will be
          updated.
        </s-paragraph>

        <s-stack direction="block" gap="small-200">
          <s-stack direction="block" gap="small-100">
            <s-text color="subdued">Product</s-text>
            <s-text type="strong">{productTitle}</s-text>
          </s-stack>

          {variant.title ? (
            <s-stack direction="block" gap="small-100">
              <s-text color="subdued">Variant</s-text>
              <s-text type="strong">{variant.title}</s-text>
            </s-stack>
          ) : null}

          <s-stack direction="block" gap="small-100">
            <s-text color="subdued">Selling price</s-text>
            <s-text>
              Current Shopify price: {currentShopifyPriceDisplay}
            </s-text>
            <s-text type="strong">New selling price: {newPriceDisplay}</s-text>
          </s-stack>

          <s-stack direction="block" gap="small-100">
            <s-text color="subdued">Product cost</s-text>
            <s-text>Current/ProfitPilot cost: {costDisplay}</s-text>
            <s-text type="strong">New Shopify cost: {costDisplay}</s-text>
          </s-stack>
        </s-stack>
      </s-stack>

      <s-button
        slot="primary-action"
        variant="primary"
        disabled={isSubmitting}
        loading={isSubmitting}
        onClick={handleConfirm}
      >
        Confirm &amp; Update Shopify
      </s-button>
      <s-button
        slot="secondary-actions"
        variant="secondary"
        disabled={isSubmitting}
        onClick={handleCancel}
      >
        Cancel
      </s-button>
    </s-modal>
  );
}
