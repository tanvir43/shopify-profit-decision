import { useCallback, useEffect, useRef } from "react";
import { useFetcher, useRevalidator } from "react-router";

import { formatCurrencyAmount } from "~/modules/cost-profiles/lib/formatCurrency";

import {
  APPLY_COMPARISON_PRICES_MODAL_ID,
  buildComparisonApplyFormPayload,
  buildComparisonApplySelections,
  canSubmitComparisonApply,
  failedComparisonApplyResults,
  formatComparisonApplyConfirmHeading,
  type ApplyComparisonPricesActionData,
  type ComparisonApplyConfirmationRow,
} from "../lib/compareApplyToShopify";
import type { StrategyInputs } from "../lib/simulateProjectedOutcome";

type ApplyComparisonPricesModalProps = {
  confirmationRows: ComparisonApplyConfirmationRow[];
  strategies: StrategyInputs;
  onApplied?: (data: ApplyComparisonPricesActionData) => void;
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
 * Confirmation before applying selected comparison simulated prices to Shopify.
 */
export function ApplyComparisonPricesModal({
  confirmationRows,
  strategies,
  onApplied,
}: ApplyComparisonPricesModalProps) {
  const fetcher = useFetcher<ApplyComparisonPricesActionData>();
  const revalidator = useRevalidator();
  const modalRef = useRef<ModalElement | null>(null);
  const handledSubmission = useRef(false);

  const isSubmitting = fetcher.state !== "idle";
  const canSubmit = canSubmitComparisonApply(
    isSubmitting,
    confirmationRows.length,
  );

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
        modalRef.current?.hideOverlay();
      }

      onApplied?.(fetcher.data);

      if (fetcher.data.appliedCount > 0) {
        revalidator.revalidate();
      }
    }
  }, [fetcher.state, fetcher.data, onApplied, revalidator]);

  const handleCancel = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    modalRef.current?.hideOverlay();
  }, [isSubmitting]);

  const handleConfirm = useCallback(() => {
    if (!canSubmit) {
      return;
    }

    handledSubmission.current = false;

    fetcher.submit(
      buildComparisonApplyFormPayload(
        buildComparisonApplySelections(confirmationRows),
        strategies,
      ),
      {
        method: "post",
        action: "/app/products/compare",
      },
    );
  }, [canSubmit, confirmationRows, fetcher, strategies]);

  const submitError =
    fetcher.data != null && !fetcher.data.ok ? fetcher.data.error : null;
  const failedRows =
    fetcher.data != null && !fetcher.data.ok
      ? failedComparisonApplyResults(fetcher.data.results)
      : [];

  return (
    <s-modal
      id={APPLY_COMPARISON_PRICES_MODAL_ID}
      heading={formatComparisonApplyConfirmHeading(confirmationRows.length)}
      ref={modalRef as never}
    >
      <s-stack direction="block" gap="base">
        {submitError ? (
          <s-banner tone="critical" heading="Could not update Shopify">
            <s-stack direction="block" gap="small-200">
              <p>{submitError}</p>
              {failedRows.map((row) => (
                <p key={`${row.trackedProductId}:${row.shopifyVariantId}`}>
                  {row.productTitle} / {row.variantTitle}
                  {row.error ? ` — ${row.error}` : ""}
                </p>
              ))}
            </s-stack>
          </s-banner>
        ) : null}

        <s-paragraph>
          This will update the selling price of the selected Shopify variants.
        </s-paragraph>

        <s-table>
          <s-table-header-row>
            <s-table-header listSlot="primary">
              Product / Variant
            </s-table-header>
            <s-table-header listSlot="labeled" format="currency">
              Current Shopify Price
            </s-table-header>
            <s-table-header listSlot="labeled" format="currency">
              New Price
            </s-table-header>
          </s-table-header-row>
          <s-table-body>
            {confirmationRows.map((row) => (
              <s-table-row
                key={`${row.trackedProductId}:${row.shopifyVariantId}`}
              >
                <s-table-cell>
                  <s-stack direction="block" gap="small-200">
                    <s-text type="strong">{row.productTitle}</s-text>
                    <s-text color="subdued">{row.variantTitle}</s-text>
                  </s-stack>
                </s-table-cell>
                <s-table-cell>
                  {formatShopifyPriceDisplay(
                    row.currentShopifyPrice,
                    row.currency,
                  )}
                </s-table-cell>
                <s-table-cell>
                  {formatCurrencyAmount(row.newPrice, row.currency)}
                </s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
      </s-stack>

      <s-button
        slot="primary-action"
        variant="primary"
        disabled={!canSubmit}
        loading={isSubmitting}
        onClick={handleConfirm}
      >
        Apply prices
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
