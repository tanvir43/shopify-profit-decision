import { useState } from "react";

import { PageLayout } from "~/components/PageLayout";
import { formatCurrencyAmount } from "~/modules/cost-profiles/lib/formatCurrency";
import type { CostProfileMode } from "~/modules/cost-profiles/types/CostProfileMode";

import { CompatibilityWarnings } from "./components/CompatibilityWarnings";
import { StickyWorkspaceHeader } from "./components/StickyWorkspaceHeader";
import { StrategyControls } from "./components/StrategyControls";
import {
  detailedSetupHref,
  formatProductStatus,
  quickStartHref,
  sellingPriceHref,
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
};

type ProductDecisionDashboardPageProps = {
  data: ProductDecisionDashboardData;
};

/**
 * Decision Workspace — live strategy simulation (PP-0015.2 / PP-0015.3 / PP-0015.6).
 * Strategy inputs are ephemeral; every active strategy feeds one projection
 * pipeline. Compatibility analysis runs after simulation and never blocks it.
 * Sticky Workspace Header keeps product + outcome essentials visible while scrolling.
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
          sellingPriceDisplay={sellingPriceDisplay}
          sellingPriceHref={sellingPriceHref(trackedProductId)}
          sellingPriceLabel={
            hasSellingPrice ? "Edit Selling Price" : "Set Selling Price"
          }
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
          detailedSetupHref={detailedSetupHref(trackedProductId)}
          isQuickStart={isQuickStart}
          quickStartHref={quickStartHref(trackedProductId)}
        />
      </s-stack>
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
  sellingPriceDisplay,
  sellingPriceHref: priceHref,
  sellingPriceLabel,
}: {
  productTitle: string;
  statusLabel: string;
  statusTone: ProductStatusTone;
  imageUrl: string | null;
  thumbnailAlt: string;
  costDisplay: string;
  sellingPriceDisplay: string;
  sellingPriceHref: string;
  sellingPriceLabel: string;
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
          <s-stack direction="block" gap="small-100">
            <s-text color="subdued">Selling Price</s-text>
            <s-text type="strong">{sellingPriceDisplay}</s-text>
          </s-stack>
          <s-button href={priceHref} variant="secondary">
            {sellingPriceLabel}
          </s-button>
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
  detailedSetupHref: breakdownHref,
  isQuickStart,
  quickStartHref: editTotalHref,
}: {
  improveAccuracyLabel: string;
  detailedSetupHref: string;
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
            <s-button href={breakdownHref} variant="primary">
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
