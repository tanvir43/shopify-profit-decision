import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

import { validateQuickStartTotalCost } from "~/modules/cost-profiles/lib/validateQuickStartTotalCost";

import { trackedProductHref } from "../lib/productStatus";
import type { QuickStartActionData } from "../QuickStartPage";
import { VariantContextBanner } from "./VariantContextBanner";
import type { VariantContext } from "../lib/variantContext";

export const QUICK_START_MODAL_ID = "quick-start-modal";

type QuickStartModalProps = {
  trackedProductId: string;
  productTitle: string;
  variant: VariantContext;
  currency: string;
  initialTotalCost?: string | null;
  heading?: string;
  saveLabel?: string;
};

type ModalElement = HTMLElement & {
  showOverlay: () => void;
  hideOverlay: () => void;
};

/**
 * Quick Start total-cost entry in a modal — avoids a full route navigation.
 */
export function QuickStartModal({
  trackedProductId,
  productTitle,
  variant,
  currency,
  initialTotalCost = null,
  heading = "Quick Start",
  saveLabel = "Save & Continue",
}: QuickStartModalProps) {
  const fetcher = useFetcher<QuickStartActionData>();
  const modalRef = useRef<ModalElement | null>(null);
  const allowClose = useRef(true);
  const isOpen = useRef(false);
  const handledSubmission = useRef(false);
  const baselineRef = useRef(initialTotalCost ?? "");
  const valueRef = useRef(initialTotalCost ?? "");

  const [value, setValue] = useState(initialTotalCost ?? "");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isSaving = fetcher.state !== "idle";

  const setValueBoth = useCallback((next: string) => {
    valueRef.current = next;
    setValue(next);
  }, []);

  const resetToBaseline = useCallback(() => {
    setValueBoth(baselineRef.current);
    setFieldError(null);
    setSaveError(null);
  }, [setValueBoth]);

  const syncFromProps = useCallback(
    (nextInitial: string | null | undefined) => {
      const next = nextInitial ?? "";
      baselineRef.current = next;
      setValueBoth(next);
      setFieldError(null);
      setSaveError(null);
    },
    [setValueBoth],
  );

  useEffect(() => {
    if (!isOpen.current) {
      syncFromProps(initialTotalCost);
    }
  }, [initialTotalCost, syncFromProps]);

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

  const handleChange = useCallback(
    (event: Event) => {
      const target = event.target as HTMLInputElement;
      setValueBoth(target.value);
      if (fieldError) {
        setFieldError(null);
      }
      if (saveError) {
        setSaveError(null);
      }
    },
    [fieldError, saveError, setValueBoth],
  );

  const handleSave = useCallback(() => {
    if (isSaving) {
      return;
    }

    setSaveError(null);

    const result = validateQuickStartTotalCost(valueRef.current);
    if (!result.ok) {
      setFieldError(result.message);
      return;
    }

    setFieldError(null);

    fetcher.submit(
      { intent: "quick-start-save", totalCost: result.value, currency },
      {
        method: "post",
        action: trackedProductHref(trackedProductId),
      },
    );
  }, [currency, fetcher, isSaving, trackedProductId]);

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
    syncFromProps(initialTotalCost);
  }, [initialTotalCost, syncFromProps]);

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
      id={QUICK_START_MODAL_ID}
      heading={heading}
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

        <s-paragraph>
          Enter the total cost of this product. You can always break it down
          into individual cost components later.
        </s-paragraph>

        <s-text-field
          label="Total Product Cost"
          name="totalCost"
          value={value}
          prefix={currency}
          disabled={isSaving}
          error={fieldError ?? undefined}
          onChange={handleChange}
        />
      </s-stack>

      <s-button
        slot="primary-action"
        variant="primary"
        disabled={isSaving}
        loading={isSaving}
        onClick={handleSave}
      >
        {saveLabel}
      </s-button>
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
