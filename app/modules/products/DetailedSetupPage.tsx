import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher, useNavigate } from "react-router";

import { PageLayout } from "~/components/PageLayout";
import { useIsNavigatingTo } from "~/hooks";
import { validateDetailedSetupAmount } from "~/modules/cost-profiles/lib/validateDetailedSetupAmount";
import {
  COST_ITEM_TYPES,
  type CostItemType,
} from "~/modules/cost-profiles/types/CostItemType";

import {
  CostBreakdownForm,
  emptyAmounts,
  type CostBreakdownAmounts,
  type CostBreakdownFieldErrors,
} from "./components/CostBreakdownForm";
import { trackedProductHref } from "./lib/productStatus";

export type DetailedSetupPageData = {
  trackedProductId: string;
  productTitle: string;
  currency: string;
  amounts: CostBreakdownAmounts;
};

export type DetailedSetupActionData =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: CostBreakdownFieldErrors };

type DetailedSetupPageProps = {
  data: DetailedSetupPageData;
};

/**
 * Detailed Cost Builder — five fixed categories, one save action (PP-0013).
 */
export function DetailedSetupPage({ data }: DetailedSetupPageProps) {
  const { trackedProductId, productTitle, currency, amounts: initialAmounts } =
    data;
  const fetcher = useFetcher<DetailedSetupActionData>();
  const navigate = useNavigate();

  const [amounts, setAmounts] = useState<CostBreakdownAmounts>(initialAmounts);
  const [fieldErrors, setFieldErrors] = useState<CostBreakdownFieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const handledSubmission = useRef(false);

  const isSaving = fetcher.state !== "idle";
  const backHref = trackedProductHref(trackedProductId);
  const isNavigatingBack = useIsNavigatingTo(backHref);

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
        navigate(`/app/products/${encodeURIComponent(trackedProductId)}`);
      } else {
        setSaveError(fetcher.data.error);
        if (fetcher.data.fieldErrors) {
          setFieldErrors(fetcher.data.fieldErrors);
        }
      }
    }
  }, [fetcher.state, fetcher.data, navigate, trackedProductId]);

  const handleAmountChange = useCallback(
    (type: CostItemType, value: string) => {
      setAmounts((prev) => ({ ...prev, [type]: value }));
      if (fieldErrors[type]) {
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next[type];
          return next;
        });
      }
      if (saveError) {
        setSaveError(null);
      }
    },
    [fieldErrors, saveError],
  );

  const handleSubmit = useCallback(() => {
    setSaveError(null);

    const nextErrors: CostBreakdownFieldErrors = {};
    for (const type of COST_ITEM_TYPES) {
      const result = validateDetailedSetupAmount(amounts[type]);
      if (!result.ok) {
        nextErrors[type] = result.message;
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});

    const formPayload: Record<string, string> = { currency };
    for (const type of COST_ITEM_TYPES) {
      formPayload[type] = amounts[type];
    }

    fetcher.submit(formPayload, { method: "post" });
  }, [amounts, currency, fetcher]);

  return (
    <PageLayout
      title={productTitle}
      breadcrumbActions={
        <s-link slot="breadcrumb-actions" href={backHref}>
          Back
        </s-link>
      }
    >
      <s-stack direction="block" gap="large-100">
        <CostBreakdownForm
          currency={currency}
          amounts={amounts}
          fieldErrors={fieldErrors}
          saveError={saveError}
          disabled={isSaving}
          onAmountChange={handleAmountChange}
        />

        <s-stack direction="inline" gap="base">
          <s-button
            variant="primary"
            disabled={isSaving}
            loading={isSaving}
            onClick={handleSubmit}
          >
            Save Cost Breakdown
          </s-button>
          <s-button
            variant="secondary"
            href={backHref}
            disabled={isSaving}
            loading={isNavigatingBack}
          >
            Back
          </s-button>
        </s-stack>
      </s-stack>
    </PageLayout>
  );
}

export { emptyAmounts };
