import { useState } from "react";

import { PageLayout } from "~/components/PageLayout";
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
  type ProductStatusTone,
} from "./lib/productStatus";
import {
  EMPTY_STRATEGY_INPUTS,
  simulateProjectedOutcome,
  type StrategyInputs,
} from "./lib/simulateProjectedOutcome";
import { analyzeStrategyCompatibility } from "./lib/strategyCompatibility";

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
 * Decision Workspace — live strategy simulation (PP-0015.2 / PP-0015.3 / PP-0015.6).
 * Strategy inputs are ephemeral; every active strategy feeds one projection
 * pipeline. Compatibility analysis runs after simulation and never blocks it.
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

  const outcome = simulateProjectedOutcome(
    { sellingPrice, totalCost },
    strategies,
  );

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

  const improveAccuracyLabel = isQuickStart
    ? "Break Down My Costs"
    : "Edit Cost Breakdown";

  const hasSellingPrice = sellingPrice != null && sellingPrice !== "";
  const sellingPriceDisplay = hasSellingPrice
    ? formatCurrencyAmount(sellingPrice, currency)
    : "—";

  return (
    <PageLayout title={productTitle}>
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
          sellingPrice={sellingPrice}
          sellingPriceDisplay={sellingPriceDisplay}
        />

        <StickyWorkspaceHeader
          productTitle={productTitle}
          costDisplay={costDisplay}
          sellingPriceDisplay={sellingPriceDisplay}
          outcome={outcome}
          currency={currency}
        />

        <CompatibilityWarnings warnings={compatibilityWarnings} />

        <StrategiesSection
          currency={currency}
          strategies={strategies}
          onStrategiesChange={setStrategies}
        />

        <ProductCostingSection
          improveAccuracyLabel={improveAccuracyLabel}
          isQuickStart={isQuickStart}
          quickStartHref={quickStartHref(trackedProductId)}
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
  sellingPrice,
  sellingPriceDisplay,
}: {
  productTitle: string;
  statusLabel: string;
  statusTone: ProductStatusTone;
  imageUrl: string | null;
  thumbnailAlt: string;
  costDisplay: string;
  trackedProductId: string;
  currency: string;
  sellingPrice: string | null;
  sellingPriceDisplay: string;
}) {
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
          <s-stack direction="block" gap="small-100">
            <s-text color="subdued">Product Cost</s-text>
            <s-text type="strong">{costDisplay}</s-text>
          </s-stack>
          <InlineSellingPriceEditor
            trackedProductId={trackedProductId}
            currency={currency}
            sellingPrice={sellingPrice}
            sellingPriceDisplay={sellingPriceDisplay}
          />
        </s-stack>
      </s-stack>
    </s-section>
  );
}

function StrategiesSection({
  currency,
  strategies,
  onStrategiesChange,
}: {
  currency: string;
  strategies: StrategyInputs;
  onStrategiesChange: (next: StrategyInputs) => void;
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
        />
      </s-stack>
    </s-section>
  );
}

function ProductCostingSection({
  improveAccuracyLabel,
  isQuickStart,
  quickStartHref: editTotalHref,
}: {
  improveAccuracyLabel: string;
  isQuickStart: boolean;
  quickStartHref: string;
}) {
  return (
    <s-section heading="Product Costing">
      <s-stack direction="block" gap="base">
        <s-box padding="base" borderWidth="base" borderRadius="base">
          <s-stack direction="block" gap="base">
            <s-stack direction="block" gap="small-100">
              <s-heading>Want more accurate recommendations?</s-heading>
              <s-paragraph color="subdued">
                Break your total cost into individual cost components for more
                precise pricing insights.
              </s-paragraph>
            </s-stack>
            <s-button
              variant="primary"
              commandFor={COST_BREAKDOWN_MODAL_ID}
              command="--show"
            >
              {improveAccuracyLabel}
            </s-button>
          </s-stack>
        </s-box>

        {isQuickStart ? (
          <s-button href={editTotalHref} variant="secondary">
            Edit Total Cost
          </s-button>
        ) : null}
      </s-stack>
    </s-section>
  );
}
