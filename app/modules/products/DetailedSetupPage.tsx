import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher, useNavigate } from "react-router";

import { PageLayout } from "~/components/PageLayout";
import { validateDetailedSetupAmount } from "~/modules/cost-profiles/lib/validateDetailedSetupAmount";
import {
  COST_ITEM_TYPES,
  COST_ITEM_TYPE_LABELS,
  type CostItemType,
} from "~/modules/cost-profiles/types/CostItemType";

export type DetailedSetupPageData = {
  trackedProductId: string;
  productTitle: string;
  currency: string;
  amounts: Record<CostItemType, string>;
};

export type DetailedSetupActionData =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Partial<Record<CostItemType, string>> };

type DetailedSetupPageProps = {
  data: DetailedSetupPageData;
};

type AmountState = Record<CostItemType, string>;
type FieldErrorState = Partial<Record<CostItemType, string>>;

function emptyAmounts(): AmountState {
  return {
    PURCHASE: "",
    PACKAGING: "",
    SHIPPING: "",
    PAYMENT_FEES: "",
    OTHER: "",
  };
}

/**
 * Detailed Cost Builder — five fixed categories, one save action (PP-0013).
 */
export function DetailedSetupPage({ data }: DetailedSetupPageProps) {
  const { trackedProductId, productTitle, currency, amounts: initialAmounts } =
    data;
  const fetcher = useFetcher<DetailedSetupActionData>();
  const navigate = useNavigate();

  const [amounts, setAmounts] = useState<AmountState>(initialAmounts);
  const [fieldErrors, setFieldErrors] = useState<FieldErrorState>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const handledSubmission = useRef(false);

  const isSaving = fetcher.state !== "idle";

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

  const handleChange = useCallback(
    (type: CostItemType) => (event: Event) => {
      const target = event.target as HTMLInputElement;
      setAmounts((prev) => ({ ...prev, [type]: target.value }));
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

    const nextErrors: FieldErrorState = {};
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

    const formPayload: Record<string, string> = {};
    for (const type of COST_ITEM_TYPES) {
      formPayload[type] = amounts[type];
    }

    fetcher.submit(formPayload, { method: "post" });
  }, [amounts, fetcher]);

  return (
    <PageLayout title={productTitle}>
      <s-stack direction="block" gap="large-100">
        {saveError ? (
          <s-banner tone="critical" heading="Could not save">
            <p>{saveError}</p>
          </s-banner>
        ) : null}

        <s-paragraph>
          Break your total cost into individual parts. Leave a field blank if
          you do not know that amount yet.
        </s-paragraph>

        <s-stack direction="block" gap="base">
          {COST_ITEM_TYPES.map((type) => (
            <s-text-field
              key={type}
              label={COST_ITEM_TYPE_LABELS[type]}
              name={type}
              value={amounts[type]}
              prefix={currency}
              disabled={isSaving}
              error={fieldErrors[type]}
              onChange={handleChange(type)}
            />
          ))}
        </s-stack>

        <s-button
          variant="primary"
          disabled={isSaving}
          loading={isSaving}
          onClick={handleSubmit}
        >
          Save Cost Breakdown
        </s-button>
      </s-stack>
    </PageLayout>
  );
}

export { emptyAmounts };
