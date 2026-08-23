import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

import { validateDetailedSetupAmount } from "~/modules/cost-profiles/lib/validateDetailedSetupAmount";
import {
  COST_ITEM_TYPES,
  type CostItemType,
} from "~/modules/cost-profiles/types/CostItemType";

import { trackedProductHref } from "../lib/productStatus";
import type { DetailedSetupActionData } from "../DetailedSetupPage";
import {
  CostBreakdownForm,
  emptyAmounts,
  type CostBreakdownAmounts,
  type CostBreakdownFieldErrors,
} from "./CostBreakdownForm";

export const ADVANCED_SETUP_MODAL_ID = "advanced-setup-modal";

type AdvancedSetupModalProps = {
  trackedProductId: string;
  currency: string;
};

type ModalElement = HTMLElement & {
  showOverlay: () => void;
  hideOverlay: () => void;
};

function amountsEqual(
  a: CostBreakdownAmounts,
  b: CostBreakdownAmounts,
): boolean {
  return COST_ITEM_TYPES.every((type) => a[type] === b[type]);
}

function cloneAmounts(amounts: CostBreakdownAmounts): CostBreakdownAmounts {
  return { ...amounts };
}

/**
 * Advanced Setup cost breakdown in a modal — avoids a full route navigation.
 */
export function AdvancedSetupModal({
  trackedProductId,
  currency,
}: AdvancedSetupModalProps) {
  const fetcher = useFetcher<DetailedSetupActionData>();
  const modalRef = useRef<ModalElement | null>(null);
  const allowClose = useRef(true);
  const isOpen = useRef(false);
  const handledSubmission = useRef(false);
  const empty = emptyAmounts();
  const baselineRef = useRef(cloneAmounts(empty));
  const amountsRef = useRef(cloneAmounts(empty));

  const [amounts, setAmounts] = useState<CostBreakdownAmounts>(() =>
    cloneAmounts(empty),
  );
  const [fieldErrors, setFieldErrors] = useState<CostBreakdownFieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const isSaving = fetcher.state !== "idle";

  const setAmountsBoth = useCallback((next: CostBreakdownAmounts) => {
    amountsRef.current = next;
    setAmounts(next);
  }, []);

  const resetToBaseline = useCallback(() => {
    const next = cloneAmounts(baselineRef.current);
    setAmountsBoth(next);
    setFieldErrors({});
    setSaveError(null);
  }, [setAmountsBoth]);

  const clearForm = useCallback(() => {
    const next = emptyAmounts();
    baselineRef.current = cloneAmounts(next);
    setAmountsBoth(cloneAmounts(next));
    setFieldErrors({});
    setSaveError(null);
  }, [setAmountsBoth]);

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
        baselineRef.current = cloneAmounts(amountsRef.current);
        modalRef.current?.hideOverlay();
      } else {
        setSaveError(fetcher.data.error);
        if (fetcher.data.fieldErrors) {
          setFieldErrors(fetcher.data.fieldErrors);
        }
      }
    }
  }, [fetcher.state, fetcher.data]);

  const handleAmountChange = useCallback(
    (type: CostItemType, value: string) => {
      const next = { ...amountsRef.current, [type]: value };
      setAmountsBoth(next);
      if (fieldErrors[type]) {
        setFieldErrors((prev) => {
          const updated = { ...prev };
          delete updated[type];
          return updated;
        });
      }
      if (saveError) {
        setSaveError(null);
      }
    },
    [fieldErrors, saveError, setAmountsBoth],
  );

  const handleSave = useCallback(() => {
    if (isSaving) {
      return;
    }

    setSaveError(null);

    const current = amountsRef.current;
    const nextErrors: CostBreakdownFieldErrors = {};
    for (const type of COST_ITEM_TYPES) {
      const result = validateDetailedSetupAmount(current[type]);
      if (!result.ok) {
        nextErrors[type] = result.message;
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});

    const formPayload: Record<string, string> = {
      intent: "detailed-setup-save",
      currency,
    };
    for (const type of COST_ITEM_TYPES) {
      formPayload[type] = current[type];
    }

    fetcher.submit(formPayload, {
      method: "post",
      action: trackedProductHref(trackedProductId),
    });
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
    clearForm();
  }, [clearForm]);

  const handleHide = useCallback(() => {
    const dirty = !amountsEqual(amountsRef.current, baselineRef.current);

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
      id={ADVANCED_SETUP_MODAL_ID}
      heading="Advanced Setup"
      size="large"
      ref={modalRef as never}
      onShow={handleShow}
      onHide={handleHide}
    >
      <CostBreakdownForm
        currency={currency}
        amounts={amounts}
        fieldErrors={fieldErrors}
        saveError={saveError}
        disabled={isSaving}
        onAmountChange={handleAmountChange}
      />

      <s-button
        slot="primary-action"
        variant="primary"
        disabled={isSaving}
        loading={isSaving}
        onClick={handleSave}
      >
        Save Cost Breakdown
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
