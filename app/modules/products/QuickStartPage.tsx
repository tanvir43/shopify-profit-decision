import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher, useNavigate } from "react-router";

import { PageLayout } from "~/components/PageLayout";
import { useIsNavigatingTo } from "~/hooks";
import { validateQuickStartTotalCost } from "~/modules/cost-profiles/lib/validateQuickStartTotalCost";

import { trackedProductHref } from "./lib/productStatus";

export type QuickStartPageData = {
  trackedProductId: string;
  productTitle: string;
  currency: string;
  totalCost: string | null;
};

export type QuickStartActionData =
  | { ok: true }
  | { ok: false; error: string };

type QuickStartPageProps = {
  data: QuickStartPageData;
};

/**
 * Quick Start cost entry — one input, one primary action (PP-0012).
 */
export function QuickStartPage({ data }: QuickStartPageProps) {
  const { trackedProductId, productTitle, currency, totalCost } = data;
  const fetcher = useFetcher<QuickStartActionData>();
  const navigate = useNavigate();

  const [value, setValue] = useState(totalCost ?? "");
  const [fieldError, setFieldError] = useState<string | null>(null);
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
      }
    }
  }, [fetcher.state, fetcher.data, navigate, trackedProductId]);

  const handleSubmit = useCallback(() => {
    setSaveError(null);

    const result = validateQuickStartTotalCost(value);
    if (!result.ok) {
      setFieldError(result.message);
      return;
    }

    setFieldError(null);

    fetcher.submit(
      { totalCost: result.value },
      { method: "post" },
    );
  }, [fetcher, value]);

  const handleChange = useCallback(
    (event: Event) => {
      const target = event.target as HTMLInputElement;
      setValue(target.value);
      if (fieldError) {
        setFieldError(null);
      }
      if (saveError) {
        setSaveError(null);
      }
    },
    [fieldError, saveError],
  );

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

        <s-stack direction="inline" gap="base">
          <s-button
            variant="primary"
            disabled={isSaving}
            loading={isSaving}
            onClick={handleSubmit}
          >
            Save &amp; Continue
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
