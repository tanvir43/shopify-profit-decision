import { Suspense, useCallback, useRef, useState, type CSSProperties, type MutableRefObject } from "react";
import { Await } from "react-router";

import { PageLayout } from "~/components/PageLayout";
import { formatCurrencyAmount } from "~/modules/cost-profiles/lib/formatCurrency";
import type { CostProfileMode } from "~/modules/cost-profiles/types/CostProfileMode";
import type { CostItemType } from "~/modules/cost-profiles/types/CostItemType";

import {
  ApplyToShopifyModal,
  APPLY_TO_SHOPIFY_MODAL_ID,
} from "./components/ApplyToShopifyModal";
import { CompatibilityWarnings } from "./components/CompatibilityWarnings";
import {
  CostBreakdownModal,
  COST_BREAKDOWN_MODAL_ID,
} from "./components/CostBreakdownModal";
import { InlineSellingPriceEditor } from "./components/InlineSellingPriceEditor";
import {
  QuickStartModal,
  QUICK_START_MODAL_ID,
} from "./components/QuickStartModal";
import { StickyWorkspaceHeader } from "./components/StickyWorkspaceHeader";
import { StrategyControls } from "./components/StrategyControls";
import {
  formatProductStatus,
  trackedProductsListHref,
  type ProductStatusTone,
} from "./lib/productStatus";
import type { VariantContext } from "./lib/variantContext";
import type { ProductDetailsEnrichment } from "./services/productDetailsEnrichment.server";
import {
  EMPTY_STRATEGY_INPUTS,
  formatEvaluatedAmount,
  formatEvaluatedSellingPrice,
  simulateProjectedOutcome,
  type StrategyInputs,
} from "./lib/simulateProjectedOutcome";
import type { StrategyId } from "./lib/strategyCatalog";
import { analyzeStrategyCompatibility } from "./lib/strategyCompatibility";
import { validateStrategyBusinessRules } from "./lib/validateStrategyBusinessRules";

export type ProductDecisionDashboardData = {
  trackedProductId: string;
  mode: CostProfileMode;
  shopifyVariantId: string;
  variant: VariantContext;
  productTitle: string;
  productStatus: string;
  imageUrl: string | null;
  imageAlt: string | null;
  currency: string;
  totalCost: string | null;
  sellingPrice: string | null;
  costAmounts: Record<CostItemType, string>;
  enrichment?: Promise<ProductDetailsEnrichment>;
};

type ProductDecisionDashboardPageProps = {
  data: ProductDecisionDashboardData;
};

type DashboardContentProps = Omit<
  ProductDecisionDashboardData,
  "enrichment"
>;

/**
 * Decision Workspace — live strategy simulation (PP-0015.2 / PP-0015.3 / PP-0015.6).
 * Shopify enrichment is deferred so the workspace appears immediately after save.
 */
export function ProductDecisionDashboardPage({
  data,
}: ProductDecisionDashboardPageProps) {
  const { enrichment, ...syncData } = data;

  if (!enrichment) {
    return <ProductDecisionDashboardContent data={syncData} />;
  }

  return (
    <Suspense
      fallback={<ProductDecisionDashboardContent data={syncData} />}
    >
      <Await resolve={enrichment}>
        {(resolved) => (
          <ProductDecisionDashboardContent
            data={{
              ...syncData,
              productTitle: resolved.productTitle,
              productStatus: resolved.productStatus,
              imageUrl: resolved.imageUrl,
              imageAlt: resolved.imageAlt,
            }}
          />
        )}
      </Await>
    </Suspense>
  );
}

function ProductDecisionDashboardContent({
  data,
}: {
  data: DashboardContentProps;
}) {
  const {
    trackedProductId,
    mode,
    shopifyVariantId,
    variant,
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
  const [applySuccessMessage, setApplySuccessMessage] = useState<string | null>(
    null,
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
    ? {
        profitLoss: null,
        marginPercent: null,
        status: null,
        evaluatedTotalCost: null,
        evaluatedSellingPrice: null,
      }
    : simulateProjectedOutcome({ sellingPrice, totalCost }, strategies);

  const evaluatedTotalCost = formatEvaluatedAmount(outcome.evaluatedTotalCost);
  const evaluatedCostDisplay =
    evaluatedTotalCost != null
      ? formatCurrencyAmount(evaluatedTotalCost, currency)
      : "—";

  const evaluatedSellingPrice = formatEvaluatedSellingPrice(
    outcome.evaluatedSellingPrice,
  );
  const evaluatedSellingPriceDisplay =
    evaluatedSellingPrice != null
      ? formatCurrencyAmount(evaluatedSellingPrice, currency)
      : "—";

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
  const hasProductCost =
    totalCost != null && totalCost.trim() !== "" && Number(totalCost) > 0;
  const canApplyToShopify =
    !calculationsPaused && hasProductCost && evaluatedSellingPrice != null;

  const handleApplyToShopifySuccess = useCallback((message: string) => {
    setApplySuccessMessage(message);
  }, []);

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
        {applySuccessMessage ? (
          <s-banner tone="success" heading="Shopify updated">
            <p>{applySuccessMessage}</p>
          </s-banner>
        ) : null}

        <ProductSummarySection
          productTitle={productTitle}
          variant={variant}
          statusLabel={statusLabel}
          statusTone={statusTone}
          imageUrl={imageUrl}
          thumbnailAlt={thumbnailAlt}
          costDisplay={costDisplay}
          trackedProductId={trackedProductId}
          shopifyVariantId={shopifyVariantId}
          currency={currency}
          totalCost={totalCost}
          sellingPrice={sellingPrice}
          sellingPriceDisplay={sellingPriceDisplay}
          showSellingPriceRequiredWarning={!sellingPriceReady}
          canApplyToShopify={canApplyToShopify}
          evaluatedCostDisplay={evaluatedCostDisplay}
          evaluatedSellingPriceDisplay={evaluatedSellingPriceDisplay}
          startSellingPriceEditRef={startSellingPriceEditRef}
          isQuickStart={isQuickStart}
        />

        <StickyWorkspaceHeader
          productTitle={productTitle}
          variantTitle={variant.title}
          costDisplay={evaluatedCostDisplay}
          sellingPriceDisplay={evaluatedSellingPriceDisplay}
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
          customStrategyErrors={strategyValidation.customStrategyErrors}
          fieldWarnings={strategyValidation.warnings}
        />
      </s-stack>

      <CostBreakdownModal
        trackedProductId={trackedProductId}
        productTitle={productTitle}
        variant={variant}
        currency={currency}
        initialAmounts={costAmounts}
      />
      {isQuickStart ? (
        <QuickStartModal
          trackedProductId={trackedProductId}
          productTitle={productTitle}
          variant={variant}
          currency={currency}
          initialTotalCost={totalCost}
          heading="Edit Total Cost"
          saveLabel="Save"
        />
      ) : null}
      {canApplyToShopify && evaluatedSellingPrice != null && totalCost != null ? (
        <ApplyToShopifyModal
          trackedProductId={trackedProductId}
          productTitle={productTitle}
          variant={variant}
          currency={currency}
          evaluatedSellingPrice={evaluatedSellingPrice}
          totalCost={totalCost}
          onSuccess={handleApplyToShopifySuccess}
        />
      ) : null}
    </PageLayout>
  );
}

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

function ProductSummarySection({
  productTitle,
  variant,
  statusLabel,
  statusTone,
  imageUrl,
  thumbnailAlt,
  costDisplay,
  evaluatedCostDisplay,
  evaluatedSellingPriceDisplay,
  trackedProductId,
  shopifyVariantId,
  currency,
  totalCost,
  sellingPrice,
  sellingPriceDisplay,
  showSellingPriceRequiredWarning,
  canApplyToShopify,
  startSellingPriceEditRef,
  isQuickStart,
}: {
  productTitle: string;
  variant: VariantContext;
  statusLabel: string;
  statusTone: ProductStatusTone;
  imageUrl: string | null;
  thumbnailAlt: string;
  costDisplay: string;
  evaluatedCostDisplay: string;
  evaluatedSellingPriceDisplay: string;
  trackedProductId: string;
  shopifyVariantId: string;
  currency: string;
  totalCost: string | null;
  sellingPrice: string | null;
  sellingPriceDisplay: string;
  showSellingPriceRequiredWarning: boolean;
  canApplyToShopify: boolean;
  startSellingPriceEditRef: MutableRefObject<(() => void) | null>;
  isQuickStart: boolean;
}) {
  return (
    <s-section heading="Product Summary">
      <div style={summaryLayoutStyle}>
        <div style={summaryMainStyle}>
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" gap="base" alignItems="center">
              {imageUrl ? (
                <s-thumbnail src={imageUrl} alt={thumbnailAlt} size="large" />
              ) : (
                <s-thumbnail alt="" size="large" />
              )}
              <s-stack direction="block" gap="small-100">
                <s-heading>{productTitle}</s-heading>
                {variant.title ? (
                  <s-badge tone="neutral">
                    <s-text color="subdued">Variant: </s-text>
                    <s-text type="strong">{variant.title}</s-text>
                  </s-badge>
                ) : null}
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
                    variant="secondary"
                    commandFor={QUICK_START_MODAL_ID}
                    command="--show"
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
                shopifyVariantId={shopifyVariantId}
                currency={currency}
                totalCost={totalCost}
                sellingPrice={sellingPrice}
                sellingPriceDisplay={sellingPriceDisplay}
                startEditRef={startSellingPriceEditRef}
              />
            </s-stack>

            {showSellingPriceRequiredWarning ? (
              <s-banner tone="warning">
                Selling Price is required before evaluation of price strategy
                simulation.
              </s-banner>
            ) : null}
          </s-stack>
        </div>

        <div style={applyPanelStyle}>
          <s-text>
            <s-text color="subdued">Product Cost: </s-text>
            <s-text type="strong">{evaluatedCostDisplay}</s-text>
          </s-text>
          <s-text>
            <s-text color="subdued">Selling Price: </s-text>
            <s-text type="strong">{evaluatedSellingPriceDisplay}</s-text>
          </s-text>
          {canApplyToShopify ? (
            <s-button
              variant="primary"
              commandFor={APPLY_TO_SHOPIFY_MODAL_ID}
              command="--show"
            >
              Apply to Shopify
            </s-button>
          ) : null}
        </div>
      </div>
    </s-section>
  );
}

const summaryLayoutStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-start",
  gap: "var(--p-space-500, 20px) var(--p-space-800, 32px)",
};

const summaryMainStyle: CSSProperties = {
  flex: "1 1 20rem",
  minWidth: 0,
};

const applyPanelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "var(--p-space-200, 8px)",
  flex: "0 0 auto",
  paddingBlockStart: "var(--p-space-100, 4px)",
};

function StrategiesSection({
  currency,
  strategies,
  onStrategiesChange,
  sellingPriceReady,
  onSetSellingPrice,
  fieldErrors,
  customStrategyErrors,
  fieldWarnings,
}: {
  currency: string;
  strategies: StrategyInputs;
  onStrategiesChange: (next: StrategyInputs) => void;
  sellingPriceReady: boolean;
  onSetSellingPrice: () => void;
  fieldErrors: Partial<Record<StrategyId, string>>;
  customStrategyErrors: Record<string, string>;
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
          customStrategyErrors={customStrategyErrors}
          fieldWarnings={fieldWarnings}
        />
      </s-stack>
    </s-section>
  );
}

