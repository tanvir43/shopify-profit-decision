import { useCallback, useRef, useState, type MutableRefObject } from "react";

import { PageLayout } from "~/components/PageLayout";
import { useIsNavigatingTo } from "~/hooks";
import { formatCurrencyAmount } from "~/modules/cost-profiles/lib/formatCurrency";
import type { CostProfileMode } from "~/modules/cost-profiles/types/CostProfileMode";
import type { CostItemType } from "~/modules/cost-profiles/types/CostItemType";

import { CompatibilityWarnings } from "./components/CompatibilityWarnings";
import {
  CostBreakdownModal,
  COST_BREAKDOWN_MODAL_ID,
} from "./components/CostBreakdownModal";
import { InlineSellingPriceEditor } from "./components/InlineSellingPriceEditor";
import { StickyWorkspaceHeader } from "./components/StickyWorkspaceHeader";
import { StrategyControls } from "./components/StrategyControls";
import {
  formatProductStatus,
  quickStartHref,
  trackedProductsListHref,
  type ProductStatusTone,
} from "./lib/productStatus";
import {
  EMPTY_STRATEGY_INPUTS,
  simulateProjectedOutcome,
  type StrategyInputs,
} from "./lib/simulateProjectedOutcome";
import type { StrategyId } from "./lib/strategyCatalog";
import { analyzeStrategyCompatibility } from "./lib/strategyCompatibility";
import { validateStrategyBusinessRules } from "./lib/validateStrategyBusinessRules";

export type ProductDecisionDashboardData = {
  trackedProductId: string;
  mode: CostProfileMode;
  productTitle: string;
  productStatus: string;
  imageUrl: string | null;
  imageAlt: string | null;
  currency: string;
  totalCost: string | null;
  sellingPrice: string | null;
  costAmounts: Record<CostItemType, string>;
};

type ProductDecisionDashboardPageProps = {
  data: ProductDecisionDashboardData;
};

/**
 * True when Selling Price is present and greater than zero.
 * Strategy saves require a usable selling price (LS-005B).
 */
function isSellingPriceReady(
  sellingPrice: string | null | undefined,
): boolean {
  if (sellingPrice == null || sellingPrice === "") {
    return false;
  }

  const value = Number(sellingPrice);
  return Number.isFinite(value) && value > 0;
}

/**
 * Decision Workspace — live strategy simulation (PP-0015.2 / PP-0015.3 / PP-0015.6).
 * Strategy inputs are ephemeral; every active strategy feeds one projection
 * pipeline. Blocking business-rule errors pause all financial projections.
 * Compatibility analysis runs after simulation and never blocks it.
 * Sticky Workspace Header keeps product + outcome essentials visible while scrolling.
 * Selling price edits inline; cost breakdown edits in a modal (PP-0015.4.5).
 */
export function ProductDecisionDashboardPage({
  data,
}: ProductDecisionDashboardPageProps) {
  const {
    trackedProductId,
    mode,
    productTitle,
    productStatus,
    imageUrl,
    imageAlt,
    currency,
    totalCost,
    sellingPrice,
    costAmounts,
  } = data;

  const [strategies, setStrategies] = useState<StrategyInputs>(
    EMPTY_STRATEGY_INPUTS,
  );
  const startSellingPriceEditRef = useRef<(() => void) | null>(null);

  const handleSetSellingPrice = useCallback(() => {
    startSellingPriceEditRef.current?.();
  }, []);

  const strategyValidation = validateStrategyBusinessRules(
    { sellingPrice, totalCost },
    strategies,
  );

  // Blocking validation pauses all financial projections — no prior result is kept.
  const calculationsPaused = strategyValidation.hasBlockingError;
  const outcome = calculationsPaused
    ? { profitLoss: null, marginPercent: null, status: null }
    : simulateProjectedOutcome({ sellingPrice, totalCost }, strategies);

  const compatibilityWarnings = analyzeStrategyCompatibility(strategies);

  const isQuickStart = mode === "QUICK_START";
  const { label: statusLabel, tone: statusTone } =
    formatProductStatus(productStatus);

  const costDisplay =
    totalCost != null
      ? formatCurrencyAmount(totalCost, currency)
      : "—";

  const thumbnailAlt =
    imageUrl && imageAlt
      ? imageAlt
      : imageUrl
        ? `Photo of ${productTitle}`
        : "";

  const hasSellingPrice = sellingPrice != null && sellingPrice !== "";
  const sellingPriceDisplay = hasSellingPrice
    ? formatCurrencyAmount(sellingPrice, currency)
    : "—";
  const sellingPriceReady = isSellingPriceReady(sellingPrice);

  const backHref = trackedProductsListHref(trackedProductId);

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
        <ProductSummarySection
          productTitle={productTitle}
          statusLabel={statusLabel}
          statusTone={statusTone}
          imageUrl={imageUrl}
          thumbnailAlt={thumbnailAlt}
          costDisplay={costDisplay}
          trackedProductId={trackedProductId}
          currency={currency}
          totalCost={totalCost}
          sellingPrice={sellingPrice}
          sellingPriceDisplay={sellingPriceDisplay}
          showSellingPriceRequiredWarning={!sellingPriceReady}
          startSellingPriceEditRef={startSellingPriceEditRef}
          isQuickStart={isQuickStart}
          editTotalCostHref={quickStartHref(trackedProductId)}
        />

        <StickyWorkspaceHeader
          productTitle={productTitle}
          costDisplay={costDisplay}
          sellingPriceDisplay={sellingPriceDisplay}
          outcome={outcome}
          currency={currency}
          calculationsPaused={calculationsPaused}
        />

        {calculationsPaused ? (
          <s-banner tone="warning">
            Profit calculation is temporarily unavailable because one or more
            active strategies contain invalid values. Please correct the
            highlighted fields to continue.
          </s-banner>
        ) : null}

        <CompatibilityWarnings warnings={compatibilityWarnings} />

        <StrategiesSection
          currency={currency}
          strategies={strategies}
          onStrategiesChange={setStrategies}
          sellingPriceReady={sellingPriceReady}
          onSetSellingPrice={handleSetSellingPrice}
          fieldErrors={strategyValidation.errors}
          fieldWarnings={strategyValidation.warnings}
        />
      </s-stack>

      <CostBreakdownModal
        trackedProductId={trackedProductId}
        currency={currency}
        initialAmounts={costAmounts}
      />
    </PageLayout>
  );
}

function ProductSummarySection({
  productTitle,
  statusLabel,
  statusTone,
  imageUrl,
  thumbnailAlt,
  costDisplay,
  trackedProductId,
  currency,
  totalCost,
  sellingPrice,
  sellingPriceDisplay,
  showSellingPriceRequiredWarning,
  startSellingPriceEditRef,
  isQuickStart,
  editTotalCostHref,
}: {
  productTitle: string;
  statusLabel: string;
  statusTone: ProductStatusTone;
  imageUrl: string | null;
  thumbnailAlt: string;
  costDisplay: string;
  trackedProductId: string;
  currency: string;
  totalCost: string | null;
  sellingPrice: string | null;
  sellingPriceDisplay: string;
  showSellingPriceRequiredWarning: boolean;
  startSellingPriceEditRef: MutableRefObject<(() => void) | null>;
  isQuickStart: boolean;
  editTotalCostHref: string;
}) {
  const isNavigatingToEditTotal = useIsNavigatingTo(
    isQuickStart ? editTotalCostHref : undefined,
  );

  return (
    <s-section heading="Product Summary">
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="base" alignItems="center">
          {imageUrl ? (
            <s-thumbnail src={imageUrl} alt={thumbnailAlt} size="large" />
          ) : (
            <s-thumbnail alt="" size="large" />
          )}
          <s-stack direction="block" gap="small-100">
            <s-heading>{productTitle}</s-heading>
            <s-badge tone={statusTone}>{statusLabel}</s-badge>
          </s-stack>
        </s-stack>

        <s-stack direction="inline" gap="large-100" alignItems="end">
          <s-stack direction="inline" gap="large-100" alignItems="end">
            <s-stack direction="block" gap="small-100">
              <s-text color="subdued">Product Cost</s-text>
              <s-text type="strong">{costDisplay}</s-text>
            </s-stack>
            {isQuickStart ? (
              <s-button
                href={editTotalCostHref}
                variant="secondary"
                loading={isNavigatingToEditTotal}
              >
                Edit Total Cost
              </s-button>
            ) : (
              <s-button
                variant="secondary"
                commandFor={COST_BREAKDOWN_MODAL_ID}
                command="--show"
              >
                Edit Cost Breakdown
              </s-button>
            )}
          </s-stack>
          <InlineSellingPriceEditor
            trackedProductId={trackedProductId}
            currency={currency}
            totalCost={totalCost}
            sellingPrice={sellingPrice}
            sellingPriceDisplay={sellingPriceDisplay}
            startEditRef={startSellingPriceEditRef}
          />
        </s-stack>

        {showSellingPriceRequiredWarning ? (
          <s-banner tone="warning">
            Selling Price is required before strategy configurations can be
            saved.
          </s-banner>
        ) : null}
      </s-stack>
    </s-section>
  );
}

function StrategiesSection({
  currency,
  strategies,
  onStrategiesChange,
  sellingPriceReady,
  onSetSellingPrice,
  fieldErrors,
  fieldWarnings,
}: {
  currency: string;
  strategies: StrategyInputs;
  onStrategiesChange: (next: StrategyInputs) => void;
  sellingPriceReady: boolean;
  onSetSellingPrice: () => void;
  fieldErrors: Partial<Record<StrategyId, string>>;
  fieldWarnings: Partial<Record<StrategyId, string>>;
}) {
  return (
    <s-section heading="Decision Strategies">
      <s-stack direction="block" gap="small-200">
        <s-paragraph color="subdued">
          Adjust strategies to simulate outcomes. The summary updates as you
          type.
        </s-paragraph>
        <StrategyControls
          currency={currency}
          values={strategies}
          onChange={onStrategiesChange}
          sellingPriceReady={sellingPriceReady}
          onSetSellingPrice={onSetSellingPrice}
          fieldErrors={fieldErrors}
          fieldWarnings={fieldWarnings}
        />
      </s-stack>
    </s-section>
  );
}

