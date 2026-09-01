import { useCallback, useEffect, useRef } from "react";
import { useFetcher, useRevalidator } from "react-router";

import { formatCurrencyAmount } from "~/modules/cost-profiles/lib/formatCurrency";

import { trackedProductHref } from "../lib/productStatus";
import type { QuickStartActionData } from "../QuickStartPage";
import type { OnboardingPreCostOption } from "../services/productOnboardingPreCost.server";

type OnboardingPreCostOptionsProps = {
  trackedProductId: string;
  currency: string;
  options: OnboardingPreCostOption[];
};

/**
 * Lets merchants adopt a cost that already exists in Shopify or ProfitPilot.
 */
export function OnboardingPreCostOptions({
  trackedProductId,
  currency,
  options,
}: OnboardingPreCostOptionsProps) {
  const fetcher = useFetcher<QuickStartActionData>();
  const revalidator = useRevalidator();
  const handledSubmission = useRef(false);
  const pendingOptionId = useRef<string | null>(null);

  const isSaving = fetcher.state !== "idle";
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
      pendingOptionId.current = null;

      if (fetcher.data.ok) {
        revalidator.revalidate();
      }
    }
  }, [fetcher.state, fetcher.data, revalidator]);

  const handleUsePreCost = useCallback(
    (optionId: string) => {
      if (isSaving) {
        return;
      }

      handledSubmission.current = false;
      pendingOptionId.current = optionId;

      fetcher.submit(
        { intent: "use-pre-cost", preCostId: optionId },
        {
          method: "post",
          action: trackedProductHref(trackedProductId),
        },
      );
    },
    [fetcher, isSaving, trackedProductId],
  );

  if (options.length === 0) {
    return null;
  }

  return (
    <s-stack direction="block" gap="base">
      <s-stack direction="block" gap="small-100">
        <s-heading>Use an existing cost</s-heading>
        <s-paragraph>
          We found product costs you can reuse for this setup. Select one to
          continue, or set up a new cost manually below.
        </s-paragraph>
      </s-stack>

      {submitError ? (
        <s-banner tone="critical" heading="Could not save">
          <s-text>{submitError}</s-text>
        </s-banner>
      ) : null}

      <s-stack direction="block" gap="small-100">
        {options.map((option) => {
          const costDisplay = formatCurrencyAmount(option.totalCost, currency);
          const isPending = pendingOptionId.current === option.id && isSaving;

          return (
            <s-box
              key={option.id}
              padding="large-100"
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
                  <s-text type="strong">{option.title}</s-text>
                  <s-text color="subdued">{option.description}</s-text>
                  <s-text type="strong">{costDisplay}</s-text>
                </s-stack>
                <s-button
                  variant="primary"
                  disabled={isSaving}
                  loading={isPending}
                  onClick={() => handleUsePreCost(option.id)}
                >
                  Use &amp; Continue
                </s-button>
              </s-stack>
            </s-box>
          );
        })}
      </s-stack>
    </s-stack>
  );
}
