import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

import { validateDetailedSetupAmount } from "~/modules/cost-profiles/lib/validateDetailedSetupAmount";
import {
  COST_ITEM_TYPES,
  type CostItemType,
} from "~/modules/cost-profiles/types/CostItemType";

import { detailedSetupHref } from "../lib/productStatus";
import type { DetailedSetupActionData } from "../DetailedSetupPage";
import {
  CostBreakdownForm,
  type CostBreakdownAmounts,
  type CostBreakdownFieldErrors,
} from "./CostBreakdownForm";

export const COST_BREAKDOWN_MODAL_ID = "cost-breakdown-modal";

type CostBreakdownModalProps = {
  trackedProductId: string;
  currency: string;
  initialAmounts: CostBreakdownAmounts;
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
 * Edit Cost Breakdown in a Polaris modal — reuses CostBreakdownForm (PP-0015.4.5).
 */
export function CostBreakdownModal({
  trackedProductId,
  currency,
  initialAmounts,
}: CostBreakdownModalProps) {
  const fetcher = useFetcher<DetailedSetupActionData>();
  const modalRef = useRef<ModalElement | null>(null);
  const allowClose = useRef(true);
  const isOpen = useRef(false);
  const handledSubmission = useRef(false);
  const baselineRef = useRef(cloneAmounts(initialAmounts));
  const amountsRef = useRef(cloneAmounts(initialAmounts));

  const [amounts, setAmounts] = useState<CostBreakdownAmounts>(() =>
    cloneAmounts(initialAmounts),
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

  const syncFromProps = useCallback(
    (nextInitial: CostBreakdownAmounts) => {
      baselineRef.current = cloneAmounts(nextInitial);
      setAmountsBoth(cloneAmounts(nextInitial));
      setFieldErrors({});
      setSaveError(null);
    },
    [setAmountsBoth],
  );

  useEffect(() => {
    // Keep closed modal in sync with revalidated workspace data.
    if (!isOpen.current) {
      syncFromProps(initialAmounts);
    }
  }, [initialAmounts, syncFromProps]);

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

    const formPayload: Record<string, string> = {};
    for (const type of COST_ITEM_TYPES) {
      formPayload[type] = current[type];
    }

    fetcher.submit(formPayload, {
      method: "post",
      action: detailedSetupHref(trackedProductId),
    });
  }, [fetcher, isSaving, trackedProductId]);

  const handleCancel = useCallback(() => {
    if (isSaving) {
      return;
    }

    allowClose.current = true;
    resetToBaseline();
    modalRef.current?.hideOverlay();
  }, [isSaving, resetToBaseline]);

  const handleShow = useCallback(() => {
    // Re-show after a blocked Escape must keep in-progress edits.
    if (isOpen.current) {
      return;
    }

    isOpen.current = true;
    allowClose.current = false;
    syncFromProps(initialAmounts);
  }, [initialAmounts, syncFromProps]);

  const handleHide = useCallback(() => {
    const dirty = !amountsEqual(amountsRef.current, baselineRef.current);

    // Escape / dismiss: only close when there are no unsaved changes.
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
      id={COST_BREAKDOWN_MODAL_ID}
      heading="Edit Cost Breakdown"
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
        Save
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
