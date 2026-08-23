import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher, useNavigate } from "react-router";

import { PageLayout } from "~/components/PageLayout";
import { useIsNavigatingTo } from "~/hooks";
import { formatCurrencyAmount } from "~/modules/cost-profiles/lib/formatCurrency";
import { validateSellingPrice } from "~/modules/cost-profiles/lib/validateSellingPrice";

import {
  SellingPriceMethodFields,
  type SellingPricePricingMethod,
} from "./components/SellingPriceMethodFields";
import { trackedProductHref } from "./lib/productStatus";

export type SellingPricePageData = {
  trackedProductId: string;
  productTitle: string;
  currency: string;
  totalCost: string | null;
  sellingPrice: string | null;
};

export type SellingPriceActionData =
  | { ok: true }
  | { ok: false; error: string };

type SellingPricePageProps = {
  data: SellingPricePageData;
};

function formatMoneyDisplay(amount: string | null, currency: string): string {
  if (amount == null || amount === "") {
    return "Not Set";
  }

  const value = Number(amount);
  if (!Number.isFinite(value)) {
    return `${currency} ${amount}`;
  }

  return `${currency} ${value.toFixed(2)}`;
}

/** Normalize a stored decimal for the editable input (max 2 fractional digits). */
function formatInputAmount(amount: string | null): string {
  if (amount == null || amount === "") {
    return "";
  }

  const value = Number(amount);
  if (!Number.isFinite(value)) {
    return amount;
  }

  return value.toFixed(2);
}

function readEventValue(event: Event): string {
  const currentTarget = event.currentTarget as { value?: string } | null;
  if (currentTarget && typeof currentTarget.value === "string") {
    return currentTarget.value;
  }

  const target = event.target as { value?: string } | null;
  return typeof target?.value === "string" ? target.value : "";
}

/**
 * Selling price entry — manual input or margin-based suggestion, then save.
 */
export function SellingPricePage({ data }: SellingPricePageProps) {
  const {
    trackedProductId,
    productTitle,
    currency,
    totalCost,
    sellingPrice,
  } = data;
  const fetcher = useFetcher<SellingPriceActionData>();
  const navigate = useNavigate();

  const [pricingMethod, setPricingMethod] =
    useState<SellingPricePricingMethod>("manual");
  const [value, setValue] = useState(() => formatInputAmount(sellingPrice));
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Keep a ref mirror so Save can read the latest keystrokes even if a
  // blur-commit onChange has not flushed through React yet.
  const latestValue = useRef(value);
  const handledSubmission = useRef(false);

  const isSaving = fetcher.state !== "idle";
  const overviewHref = trackedProductHref(trackedProductId);
  const isNavigatingAway = useIsNavigatingTo(overviewHref);

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
        navigate(overviewHref);
      } else {
        setSaveError(fetcher.data.error);
      }
    }
  }, [fetcher.state, fetcher.data, navigate, overviewHref]);

  const handleSubmit = useCallback(() => {
    setSaveError(null);
    handledSubmission.current = false;

    const raw = latestValue.current;
    setValue(raw);

    const result = validateSellingPrice(raw);
    if (!result.ok) {
      // Surface the selling-price field if Save was pressed from margin mode.
      setPricingMethod("manual");
      setFieldError(result.message);
      return;
    }

    setFieldError(null);

    fetcher.submit(
      { sellingPrice: result.value },
      { method: "post" },
    );
  }, [fetcher]);

  const handleInput = useCallback(
    (event: Event) => {
      const next = readEventValue(event);
      latestValue.current = next;
      setValue(next);
      if (fieldError) {
        setFieldError(null);
      }
      if (saveError) {
        setSaveError(null);
      }
    },
    [fieldError, saveError],
  );

  const handleSuggestedPriceApplied = useCallback((suggested: string) => {
    latestValue.current = suggested;
    setValue(suggested);
    setFieldError(null);
    setSaveError(null);
  }, []);

  const costDisplay =
    totalCost != null
      ? formatCurrencyAmount(totalCost, currency)
      : "Not Available";

  return (
    <PageLayout title={productTitle}>
      <s-stack direction="block" gap="large-100">
        {saveError ? (
          <s-banner tone="critical" heading="Could not save">
            <p>{saveError}</p>
          </s-banner>
        ) : null}

        <s-heading>{productTitle}</s-heading>

        <s-stack direction="block" gap="small-200">
          <s-text color="subdued">Current Product Cost</s-text>
          <s-text>{costDisplay}</s-text>
        </s-stack>

        <s-stack direction="block" gap="small-200">
          <s-text color="subdued">Current Selling Price</s-text>
          <s-text>{formatMoneyDisplay(sellingPrice, currency)}</s-text>
        </s-stack>

        <SellingPriceMethodFields
          currency={currency}
          totalCost={totalCost}
          pricingMethod={pricingMethod}
          onPricingMethodChange={setPricingMethod}
          sellingPriceValue={value}
          sellingPriceError={fieldError ?? undefined}
          disabled={isSaving}
          onSellingPriceInput={handleInput}
          onSuggestedPriceApplied={handleSuggestedPriceApplied}
        />

        {pricingMethod === "manual" ? (
          <s-stack direction="inline" gap="base">
            <s-button
              variant="primary"
              disabled={isSaving}
              loading={isSaving}
              onClick={handleSubmit}
            >
              Save
            </s-button>
            <s-button
              variant="secondary"
              href={overviewHref}
              disabled={isSaving}
              loading={isNavigatingAway}
            >
              Cancel
            </s-button>
          </s-stack>
        ) : null}
      </s-stack>
    </PageLayout>
  );
}
