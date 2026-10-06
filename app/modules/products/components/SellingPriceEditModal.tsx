import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

import { validateSellingPrice } from "~/modules/cost-profiles/lib/validateSellingPrice";

import { sellingPriceHref } from "../lib/productStatus";
import type { VariantContext } from "../lib/variantContext";
import type { SellingPriceActionData } from "../SellingPricePage";
import {
  SellingPriceMethodFields,
  type SellingPricePricingMethod,
} from "./SellingPriceMethodFields";
import { VariantContextBanner } from "./VariantContextBanner";

type SellingPriceEditModalProps = {
  modalId: string;
  trackedProductId: string;
  productTitle: string;
  variant: VariantContext;
  currency: string;
  totalCost: string | null;
  sellingPrice: string | null;
  shopifyVariantId: string;
};

type ModalElement = HTMLElement & {
  showOverlay: () => void;
  hideOverlay: () => void;
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
 * Compare-table Current Price editor — same validation, persistence, and
 * SellingPriceMethodFields as the Decision Workspace inline editor.
 */
export function SellingPriceEditModal({
  modalId,
  trackedProductId,
  productTitle,
  variant,
  currency,
  totalCost,
  sellingPrice,
  shopifyVariantId,
}: SellingPriceEditModalProps) {
  const fetcher = useFetcher<SellingPriceActionData>();
  const modalRef = useRef<ModalElement | null>(null);
  const allowClose = useRef(true);
  const isOpen = useRef(false);
  const handledSubmission = useRef(false);
  const baselineRef = useRef(formatInputAmount(sellingPrice));
  const valueRef = useRef(formatInputAmount(sellingPrice));

  const [pricingMethod, setPricingMethod] =
    useState<SellingPricePricingMethod>("manual");
  const [value, setValue] = useState(() => formatInputAmount(sellingPrice));
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isSaving = fetcher.state !== "idle";

  const setValueBoth = useCallback((next: string) => {
    valueRef.current = next;
    setValue(next);
  }, []);

  const resetToBaseline = useCallback(() => {
    setValueBoth(baselineRef.current);
    setPricingMethod("manual");
    setFieldError(null);
    setSaveError(null);
  }, [setValueBoth]);

  const syncFromProps = useCallback(
    (nextSellingPrice: string | null) => {
      const next = formatInputAmount(nextSellingPrice);
      baselineRef.current = next;
      setValueBoth(next);
      setPricingMethod("manual");
      setFieldError(null);
      setSaveError(null);
    },
    [setValueBoth],
  );

  useEffect(() => {
    if (!isOpen.current) {
      syncFromProps(sellingPrice);
    }
  }, [sellingPrice, syncFromProps]);

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
        allowClose.current = true;
        baselineRef.current = valueRef.current;
        modalRef.current?.hideOverlay();
      } else {
        setSaveError(fetcher.data.error);
      }
    }
  }, [fetcher.state, fetcher.data]);

  const handleInput = useCallback(
    (event: Event) => {
      setValueBoth(readEventValue(event));
      if (fieldError) {
        setFieldError(null);
      }
      if (saveError) {
        setSaveError(null);
      }
    },
    [fieldError, saveError, setValueBoth],
  );

  const handleSuggestedPriceApplied = useCallback((suggested: string) => {
    setValueBoth(suggested);
    setFieldError(null);
    setSaveError(null);
  }, [setValueBoth]);

  const handleSave = useCallback(() => {
    if (isSaving) {
      return;
    }

    setSaveError(null);
    handledSubmission.current = false;

    const result = validateSellingPrice(valueRef.current);
    if (!result.ok) {
      setPricingMethod("manual");
      setFieldError(result.message);
      return;
    }

    setFieldError(null);

    fetcher.submit(
      { sellingPrice: result.value, shopifyVariantId },
      {
        method: "post",
        action: sellingPriceHref(trackedProductId),
      },
    );
  }, [fetcher, isSaving, shopifyVariantId, trackedProductId]);

  const handleCancel = useCallback(() => {
    if (isSaving) {
      return;
    }

    allowClose.current = true;
    resetToBaseline();
    modalRef.current?.hideOverlay();
  }, [isSaving, resetToBaseline]);

  const handleShow = useCallback(() => {
    if (isOpen.current) {
      return;
    }

    isOpen.current = true;
    allowClose.current = false;
    syncFromProps(sellingPrice);
  }, [sellingPrice, syncFromProps]);

  const handleHide = useCallback(() => {
    const dirty = valueRef.current !== baselineRef.current;

    if (!allowClose.current && dirty) {
      requestAnimationFrame(() => {
        modalRef.current?.showOverlay();
      });
      return;
    }

    isOpen.current = false;
    allowClose.current = true;
    resetToBaseline();
  }, [resetToBaseline]);

  return (
    <s-modal
      id={modalId}
      heading="Edit Selling Price"
      ref={modalRef as never}
      onShow={handleShow}
      onHide={handleHide}
    >
      <s-stack direction="block" gap="base">
        <VariantContextBanner productTitle={productTitle} variant={variant} />

        {saveError ? (
          <s-banner tone="critical" heading="Could not save">
            <p>{saveError}</p>
          </s-banner>
        ) : null}

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
      </s-stack>

      {pricingMethod === "manual" ? (
        <s-button
          slot="primary-action"
          variant="primary"
          disabled={isSaving}
          loading={isSaving}
          onClick={handleSave}
        >
          Save
        </s-button>
      ) : null}
      <s-button
        slot="secondary-actions"
        variant="secondary"
        disabled={isSaving}
        onClick={handleCancel}
      >
        Cancel
      </s-button>
    </s-modal>
  );
}
