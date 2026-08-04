import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useFetcher } from "react-router";

import { validateSellingPrice } from "~/modules/cost-profiles/lib/validateSellingPrice";

import { sellingPriceHref } from "../lib/productStatus";
import type { SellingPriceActionData } from "../SellingPricePage";

type InlineSellingPriceEditorProps = {
  trackedProductId: string;
  currency: string;
  sellingPrice: string | null;
  sellingPriceDisplay: string;
};

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
 * Inline selling-price edit on Product Summary — same page, no modal (PP-0015.4.5).
 */
export function InlineSellingPriceEditor({
  trackedProductId,
  currency,
  sellingPrice,
  sellingPriceDisplay,
}: InlineSellingPriceEditorProps) {
  const fetcher = useFetcher<SellingPriceActionData>();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(() => formatInputAmount(sellingPrice));
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const latestValue = useRef(value);
  const inputRef = useRef<HTMLElement | null>(null);
  const handledSubmission = useRef(false);

  const isSaving = fetcher.state !== "idle";

  useEffect(() => {
    if (!editing) {
      const next = formatInputAmount(sellingPrice);
      setValue(next);
      latestValue.current = next;
    }
  }, [sellingPrice, editing]);

  useEffect(() => {
    if (!editing) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => cancelAnimationFrame(frame);
  }, [editing]);

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
        setEditing(false);
        setFieldError(null);
        setSaveError(null);
      } else {
        setSaveError(fetcher.data.error);
      }
    }
  }, [fetcher.state, fetcher.data]);

  const handleCancel = useCallback(() => {
    if (isSaving) {
      return;
    }

    const next = formatInputAmount(sellingPrice);
    setValue(next);
    latestValue.current = next;
    setFieldError(null);
    setSaveError(null);
    setEditing(false);
  }, [isSaving, sellingPrice]);

  const handleSave = useCallback(() => {
    if (isSaving) {
      return;
    }

    setSaveError(null);
    handledSubmission.current = false;

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
      {
        method: "post",
        action: sellingPriceHref(trackedProductId),
      },
    );
  }, [fetcher, isSaving, trackedProductId]);

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

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleSave();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        handleCancel();
      }
    },
    [handleCancel, handleSave],
  );

  if (!editing) {
    return (
      <s-stack direction="inline" gap="large-100" alignItems="end">
        <s-stack direction="block" gap="small-100">
          <s-text color="subdued">Selling Price</s-text>
          <s-text type="strong">{sellingPriceDisplay}</s-text>
        </s-stack>
        <s-button variant="secondary" onClick={() => setEditing(true)}>
          Edit
        </s-button>
      </s-stack>
    );
  }

  return (
    <div onKeyDown={handleKeyDown}>
      <s-stack direction="block" gap="small-200">
        {saveError ? (
          <s-banner tone="critical" heading="Could not save">
            <p>{saveError}</p>
          </s-banner>
        ) : null}

        <s-text-field
          ref={inputRef as never}
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
            onClick={handleSave}
          >
            Save
          </s-button>
          <s-button
            variant="secondary"
            disabled={isSaving}
            onClick={handleCancel}
          >
            Cancel
          </s-button>
        </s-stack>
      </s-stack>
    </div>
  );
}
