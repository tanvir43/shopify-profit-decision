import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

import { PageLayout } from "~/components/PageLayout";
import { formatCurrencyAmount } from "~/modules/cost-profiles/lib/formatCurrency";
import { validateSellingPrice } from "~/modules/cost-profiles/lib/validateSellingPrice";

import { trackedProductHref } from "./lib/productStatus";

export type SellingPricePageData = {
  trackedProductId: string;
  productTitle: string;
  currency: string;
  totalCost: string | null;
  sellingPrice: string | null;
};

export type SellingPriceActionData = { ok: false; error: string };

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
 * Selling price entry — one input, save or cancel. No calculations.
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

  const [value, setValue] = useState(() => formatInputAmount(sellingPrice));
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Keep a ref mirror so Save can read the latest keystrokes even if a
  // blur-commit onChange has not flushed through React yet.
  const latestValue = useRef(value);
  const handledError = useRef<string | null>(null);

  const isSaving = fetcher.state !== "idle";
  const overviewHref = trackedProductHref(trackedProductId);

  useEffect(() => {
    if (fetcher.state !== "idle" || fetcher.data == null) {
      return;
    }

    const errorKey = fetcher.data.error;
    if (handledError.current === errorKey) {
      return;
    }

    handledError.current = errorKey;
    setSaveError(fetcher.data.error);
  }, [fetcher.state, fetcher.data]);

  const handleSubmit = useCallback(() => {
    setSaveError(null);
    handledError.current = null;

    const raw = latestValue.current;
    setValue(raw);

    const result = validateSellingPrice(raw);
    if (!result.ok) {
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
        handledError.current = null;
      }
    },
    [fieldError, saveError],
  );

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

        <s-text-field
          label="Selling Price"
          name="sellingPrice"
          value={value}
          prefix={currency}
          disabled={isSaving}
          error={fieldError ?? undefined}
          onInput={handleInput}
          onChange={handleInput}
        />

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
          >
            Cancel
          </s-button>
        </s-stack>
      </s-stack>
    </PageLayout>
  );
}
