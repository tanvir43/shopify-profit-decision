import { useCallback, useMemo, useState, type CSSProperties } from "react";

import { PageLayout } from "~/components/PageLayout";
import { formatCurrencyAmount } from "~/modules/cost-profiles/lib/formatCurrency";

import { ApplyComparisonPricesModal } from "./components/ApplyComparisonPricesModal";
import { CompatibilityWarnings } from "./components/CompatibilityWarnings";
import { CostBreakdownModal } from "./components/CostBreakdownModal";
import { QuickStartModal } from "./components/QuickStartModal";
import { SaveComparisonModal } from "./components/SaveComparisonModal";
import { SellingPriceEditModal } from "./components/SellingPriceEditModal";
import { StrategyControls } from "./components/StrategyControls";
import {
  COMPARISON_COST_MISSING_LABEL,
  aggregateSharedStrategyValidation,
  compareAddCostModalId,
  compareEditDetailedCostModalId,
  compareEditPriceModalId,
  formatComparisonProfitLoss,
  formatComparisonReadinessSummary,
  formatComparisonResultMargin,
  formatComparisonSelectionSummary,
  formatComparisonSimulatedPrice,
  formatCurrentComparisonMargin,
  listActiveComparisonStrategyColumns,
  resolveActiveComparisonSnapshot,
  simulateComparisonRow,
  summarizeComparisonReadiness,
  toComparisonSimulationBaseline,
  type CompareScenariosPageData,
  type ComparisonProduct,
  type ComparisonReadinessSummary,
  type ComparisonRowSimulation,
  type ComparisonSnapshot,
  type ComparisonStrategyColumn,
} from "./lib/compareScenarios";
import {
  APPLY_COMPARISON_PRICES_MODAL_ID,
  buildComparisonApplyConfirmationRows,
  clearSuccessfulComparisonApplySelection,
  comparisonApplySelectAllState,
  filterSelectedComparisonApplyIds,
  formatComparisonApplySelectionLabel,
  listEligibleComparisonApplyIds,
  nextComparisonApplySelectionAfterSelectAll,
  shouldShowComparisonApplyAction,
  toggleComparisonApplySelection,
  type ApplyComparisonPricesActionData,
} from "./lib/compareApplyToShopify";
import { trackedProductsListHref } from "./lib/productStatus";
import {
  buildSavedComparisonItemsFromSnapshots,
  formatRestoredComparisonSkipMessage,
  SAVE_COMPARISON_MODAL_ID,
} from "./lib/savedComparisons";
import {
  EMPTY_STRATEGY_INPUTS,
  type OutcomeStatus,
  type StrategyInputs,
} from "./lib/simulateProjectedOutcome";
import type { StrategyId } from "./lib/strategyCatalog";
import { analyzeStrategyCompatibility } from "./lib/strategyCompatibility";
import type { VariantContext } from "./lib/variantContext";

export type { CompareScenariosPageData };

type CompareScenariosPageProps = {
  data: CompareScenariosPageData;
};

type ComparisonRow = {
  product: ComparisonProduct;
  snapshot: ComparisonSnapshot;
};

type ComparisonSimulatedRow = ComparisonRow & {
  simulation: ComparisonRowSimulation;
};

function readEventValue(event: Event): string {
  const currentTarget = event.currentTarget as { value?: string } | null;
  if (currentTarget && typeof currentTarget.value === "string") {
    return currentTarget.value;
  }

  const target = event.target as { value?: string } | null;
  return typeof target?.value === "string" ? target.value : "";
}

function formatMoneyOrPlaceholder(
  amount: string | null,
  currency: string,
): string {
  return amount != null ? formatCurrencyAmount(amount, currency) : "—";
}

/**
 * Multi-product comparison: one shared Decision Strategies scenario,
 * evaluated independently against each selected product/variant.
 */
export function CompareScenariosPage({ data }: CompareScenariosPageProps) {
  const { products, restoredComparison } = data;
  const [variantOverrides, setVariantOverrides] = useState<
    Record<string, string>
  >({});
  const [strategies, setStrategies] = useState<StrategyInputs>(
    EMPTY_STRATEGY_INPUTS,
  );
  const [applySelectedIds, setApplySelectedIds] = useState<string[]>([]);
  const [applyResult, setApplyResult] =
    useState<ApplyComparisonPricesActionData | null>(null);

  const snapshots = useMemo(
    () =>
      products.map((product) => ({
        product,
        snapshot: resolveActiveComparisonSnapshot(
          product,
          variantOverrides[product.trackedProductId],
        ),
      })),
    [products, variantOverrides],
  );

  const simulatedRows = useMemo<ComparisonSimulatedRow[]>(
    () =>
      snapshots.map(({ product, snapshot }) => ({
        product,
        snapshot,
        simulation: simulateComparisonRow(
          toComparisonSimulationBaseline(snapshot),
          strategies,
          { costReady: snapshot.costReady },
        ),
      })),
    [snapshots, strategies],
  );

  const readiness = summarizeComparisonReadiness(
    snapshots.map((item) => item.snapshot),
  );
  const currency = products[0]?.currency ?? "USD";
  const strategyColumns = listActiveComparisonStrategyColumns(
    strategies,
    currency,
  );
  const sharedValidation = aggregateSharedStrategyValidation(
    simulatedRows
      .filter(({ snapshot }) => snapshot.currentPrice != null)
      .map(({ simulation }) => simulation.validation),
  );
  const compatibilityWarnings = analyzeStrategyCompatibility(strategies);
  const eligibleApplyIds = useMemo(
    () => listEligibleComparisonApplyIds(simulatedRows),
    [simulatedRows],
  );
  const selectedApplyIds = useMemo(
    () => filterSelectedComparisonApplyIds(applySelectedIds, eligibleApplyIds),
    [applySelectedIds, eligibleApplyIds],
  );
  const selectAllState = comparisonApplySelectAllState(
    eligibleApplyIds,
    selectedApplyIds,
  );
  const confirmationRows = useMemo(
    () => buildComparisonApplyConfirmationRows(simulatedRows, selectedApplyIds),
    [simulatedRows, selectedApplyIds],
  );
  const showApplyAction = shouldShowComparisonApplyAction(
    selectedApplyIds.length,
  );

  const handleApplySelectionChange = useCallback(
    (trackedProductId: string, checked: boolean) => {
      setApplySelectedIds((current) =>
        toggleComparisonApplySelection(
          current,
          trackedProductId,
          checked,
          eligibleApplyIds,
        ),
      );
    },
    [eligibleApplyIds],
  );

  const handleSelectAllApplyChange = useCallback(
    (checked: boolean) => {
      setApplySelectedIds(
        nextComparisonApplySelectionAfterSelectAll(eligibleApplyIds, checked),
      );
    },
    [eligibleApplyIds],
  );

  const handleApplyResult = useCallback(
    (data: ApplyComparisonPricesActionData) => {
      setApplyResult(data);
      setApplySelectedIds((current) =>
        clearSuccessfulComparisonApplySelection(current, data.results),
      );
    },
    [],
  );

  const handleVariantChange = useCallback(
    (trackedProductId: string, shopifyVariantId: string) => {
      setVariantOverrides((current) => ({
        ...current,
        [trackedProductId]: shopifyVariantId,
      }));
    },
    [],
  );

  const saveItems = useMemo(
    () =>
      buildSavedComparisonItemsFromSnapshots(
        snapshots.map(({ product, snapshot }) => ({
          trackedProductId: product.trackedProductId,
          shopifyVariantId: snapshot.variantId,
        })),
      ),
    [snapshots],
  );
  const skippedUnavailableCount =
    restoredComparison?.skippedUnavailableCount ?? 0;

  return (
    <PageLayout
      title="Compare pricing scenarios"
      breadcrumbActions={
        <s-link slot="breadcrumb-actions" href={trackedProductsListHref()}>
          Back
        </s-link>
      }
    >
      {skippedUnavailableCount > 0 ? (
        <s-banner tone="warning" heading="Some items could not be restored">
          <s-text>
            {formatRestoredComparisonSkipMessage(skippedUnavailableCount)}
          </s-text>
        </s-banner>
      ) : null}

      {products.length === 0 ? (
        <CompareEmptyState />
      ) : (
        <s-stack direction="block" gap="large-100">
          <s-stack
            direction="inline"
            gap="base"
            alignItems="center"
            justifyContent="space-between"
          >
            <s-text>
              {formatComparisonSelectionSummary(readiness.selectedCount)}
            </s-text>
            {saveItems.length > 0 ? (
              <s-button
                variant="secondary"
                commandFor={SAVE_COMPARISON_MODAL_ID}
                command="--show"
              >
                Save comparison
              </s-button>
            ) : null}
          </s-stack>

          <SelectedProductsSection
            rows={snapshots}
            readiness={readiness}
            onVariantChange={handleVariantChange}
          />

          <CompatibilityWarnings warnings={compatibilityWarnings} />

          <StrategiesSection
            currency={currency}
            strategies={strategies}
            onStrategiesChange={setStrategies}
            fieldErrors={sharedValidation.errors}
            customStrategyErrors={sharedValidation.customStrategyErrors}
            fieldWarnings={sharedValidation.warnings}
          />

          <ComparisonPreviewTable
            rows={simulatedRows}
            strategyColumns={strategyColumns}
            selectedIds={selectedApplyIds}
            selectAllState={selectAllState}
            eligibleIds={eligibleApplyIds}
            showApplyAction={showApplyAction}
            applyResult={applyResult}
            onApplySelectionChange={handleApplySelectionChange}
            onSelectAllChange={handleSelectAllApplyChange}
          />

          {confirmationRows.length > 0 ? (
            <ApplyComparisonPricesModal
              confirmationRows={confirmationRows}
              strategies={strategies}
              onApplied={handleApplyResult}
            />
          ) : null}

          {saveItems.length > 0 ? (
            <SaveComparisonModal items={saveItems} />
          ) : null}
        </s-stack>
      )}
    </PageLayout>
  );
}

function CompareEmptyState() {
  return (
    <s-section accessibilityLabel="No products selected">
      <s-stack direction="block" gap="base">
        <s-text>
          Select tracked products to compare pricing scenarios.
        </s-text>
        <s-button href={trackedProductsListHref()} variant="primary">
          Back to Tracked Products
        </s-button>
      </s-stack>
    </s-section>
  );
}

function SelectedProductsSection({
  rows,
  readiness,
  onVariantChange,
}: {
  rows: ComparisonRow[];
  readiness: ComparisonReadinessSummary;
  onVariantChange: (trackedProductId: string, shopifyVariantId: string) => void;
}) {
  return (
    <s-section heading="Selected products" accessibilityLabel="Selected products">
      <s-stack direction="block" gap="small-100">
        <s-text color="subdued">
          {formatComparisonReadinessSummary(
            readiness.readyCount,
            readiness.needsCostCount,
          )}
        </s-text>

        <s-table>
          <s-table-header-row>
            <s-table-header listSlot="primary">Product / Variant</s-table-header>
            <s-table-header listSlot="labeled" format="currency">
              Current Price
            </s-table-header>
            <s-table-header listSlot="labeled" format="currency">
              Cost
            </s-table-header>
            <s-table-header listSlot="labeled">Status</s-table-header>
            <s-table-header listSlot="labeled">Action</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {rows.map(({ product, snapshot }) => (
              <SelectedProductRow
                key={product.trackedProductId}
                product={product}
                snapshot={snapshot}
                onVariantChange={onVariantChange}
              />
            ))}
          </s-table-body>
        </s-table>

        {rows.map(({ product, snapshot }) => (
          <SelectedProductEditors
            key={product.trackedProductId}
            product={product}
            snapshot={snapshot}
          />
        ))}
      </s-stack>
    </s-section>
  );
}

function SelectedProductRow({
  product,
  snapshot,
  onVariantChange,
}: {
  product: ComparisonProduct;
  snapshot: ComparisonSnapshot;
  onVariantChange: (trackedProductId: string, shopifyVariantId: string) => void;
}) {
  const costModalId = selectedProductCostModalId(product, snapshot);
  const priceModalId = compareEditPriceModalId(product.trackedProductId);

  return (
    <s-table-row>
      <s-table-cell>
        <s-stack direction="block" gap="small-200">
          <s-text type="strong">{product.title}</s-text>
          {product.variants.length > 1 ? (
            <s-select
              label={`Variant for ${product.title}`}
              labelAccessibilityVisibility="exclusive"
              value={snapshot.variantId ?? undefined}
              onChange={(event: Event) => {
                onVariantChange(product.trackedProductId, readEventValue(event));
              }}
            >
              {product.variants.map((variant) => (
                <s-option key={variant.id} value={variant.id}>
                  {variant.title}
                </s-option>
              ))}
            </s-select>
          ) : (
            <s-text color="subdued">{snapshot.variantTitle}</s-text>
          )}
        </s-stack>
      </s-table-cell>
      <s-table-cell>
        <s-stack direction="block" gap="small-200">
          <s-text>
            {formatMoneyOrPlaceholder(snapshot.currentPrice, product.currency)}
          </s-text>
          {snapshot.costReady ? (
            <s-button
              variant="tertiary"
              commandFor={priceModalId}
              command="--show"
            >
              Edit
            </s-button>
          ) : null}
        </s-stack>
      </s-table-cell>
      <s-table-cell>
        <s-stack direction="block" gap="small-200">
          <s-text>
            {formatMoneyOrPlaceholder(snapshot.effectiveCost, product.currency)}
          </s-text>
          {snapshot.costReady ? (
            <s-button
              variant="tertiary"
              commandFor={costModalId}
              command="--show"
            >
              Edit
            </s-button>
          ) : null}
        </s-stack>
      </s-table-cell>
      <s-table-cell>
        {snapshot.costReady ? (
          <s-badge tone="success">Ready</s-badge>
        ) : (
          <s-badge tone="warning">Cost missing</s-badge>
        )}
      </s-table-cell>
      <s-table-cell>
        {snapshot.costReady ? null : (
          <s-button
            variant="secondary"
            commandFor={costModalId}
            command="--show"
          >
            Add cost
          </s-button>
        )}
      </s-table-cell>
    </s-table-row>
  );
}

function SelectedProductEditors({
  product,
  snapshot,
}: {
  product: ComparisonProduct;
  snapshot: ComparisonSnapshot;
}) {
  const variantContext: VariantContext = {
    shopifyVariantId: snapshot.variantId ?? snapshot.costProfileVariantId,
    title: product.variants.length > 1 ? snapshot.variantTitle : null,
    price: snapshot.currentPrice,
  };
  const selectedVariantId = snapshot.variantId ?? "";

  return (
    <>
      {snapshot.costReady ? (
        <SellingPriceEditModal
          modalId={compareEditPriceModalId(product.trackedProductId)}
          trackedProductId={product.trackedProductId}
          productTitle={product.title}
          variant={variantContext}
          currency={product.currency}
          totalCost={snapshot.effectiveCost}
          sellingPrice={snapshot.currentPrice}
          shopifyVariantId={snapshot.costProfileVariantId}
        />
      ) : null}

      {snapshot.costMode === "DETAILED" ? (
        <CostBreakdownModal
          modalId={compareEditDetailedCostModalId(product.trackedProductId)}
          trackedProductId={product.trackedProductId}
          productTitle={product.title}
          variant={variantContext}
          currency={product.currency}
          initialAmounts={snapshot.costAmounts}
          action="/app/products/compare"
          shopifyVariantId={selectedVariantId}
        />
      ) : (
        <QuickStartModal
          modalId={compareAddCostModalId(product.trackedProductId)}
          trackedProductId={product.trackedProductId}
          productTitle={product.title}
          variant={variantContext}
          currency={product.currency}
          initialTotalCost={
            snapshot.effectiveCost ?? snapshot.shopifyUnitCost ?? null
          }
          shopifyVariantId={selectedVariantId}
          action="/app/products/compare"
          heading={snapshot.costReady ? "Edit Total Cost" : "Add cost"}
          saveLabel={snapshot.costReady ? "Save" : "Save cost"}
        />
      )}
    </>
  );
}

function selectedProductCostModalId(
  product: ComparisonProduct,
  snapshot: ComparisonSnapshot,
): string {
  return snapshot.costMode === "DETAILED"
    ? compareEditDetailedCostModalId(product.trackedProductId)
    : compareAddCostModalId(product.trackedProductId);
}

function StrategiesSection({
  currency,
  strategies,
  onStrategiesChange,
  fieldErrors,
  customStrategyErrors,
  fieldWarnings,
}: {
  currency: string;
  strategies: StrategyInputs;
  onStrategiesChange: (next: StrategyInputs) => void;
  fieldErrors: Partial<Record<StrategyId, string>>;
  customStrategyErrors: Record<string, string>;
  fieldWarnings: Partial<Record<StrategyId, string>>;
}) {
  return (
    <s-section heading="Decision Strategies">
      <s-stack direction="block" gap="small-200">
        <s-paragraph color="subdued">
          Adjust strategies to simulate outcomes. The comparison updates as you
          type.
        </s-paragraph>
        <StrategyControls
          currency={currency}
          values={strategies}
          onChange={onStrategiesChange}
          sellingPriceReady
          onSetSellingPrice={noopSetSellingPrice}
          fieldErrors={fieldErrors}
          customStrategyErrors={customStrategyErrors}
          fieldWarnings={fieldWarnings}
        />
      </s-stack>
    </s-section>
  );
}

function readChecked(event: Event): boolean {
  const currentTarget = event.currentTarget as { checked?: boolean } | null;
  if (currentTarget && typeof currentTarget.checked === "boolean") {
    return currentTarget.checked;
  }

  const target = event.target as { checked?: boolean } | null;
  return Boolean(target?.checked);
}

function ComparisonPreviewTable({
  rows,
  strategyColumns,
  selectedIds,
  selectAllState,
  eligibleIds,
  showApplyAction,
  applyResult,
  onApplySelectionChange,
  onSelectAllChange,
}: {
  rows: ComparisonSimulatedRow[];
  strategyColumns: ComparisonStrategyColumn[];
  selectedIds: string[];
  selectAllState: { checked: boolean; indeterminate: boolean };
  eligibleIds: string[];
  showApplyAction: boolean;
  applyResult: ApplyComparisonPricesActionData | null;
  onApplySelectionChange: (trackedProductId: string, checked: boolean) => void;
  onSelectAllChange: (checked: boolean) => void;
}) {
  const selectedIdSet = new Set(selectedIds);
  const eligibleIdSet = new Set(eligibleIds);

  return (
    <s-section accessibilityLabel="Comparison">
      <s-stack direction="block" gap="small-100">
        {applyResult ? <ComparisonApplyResultBanner data={applyResult} /> : null}

        {showApplyAction ? (
          <s-stack
            direction="inline"
            gap="base"
            alignItems="center"
            justifyContent="space-between"
          >
            <s-text>
              {formatComparisonApplySelectionLabel(selectedIds.length)}
            </s-text>
            <s-button
              variant="primary"
              commandFor={APPLY_COMPARISON_PRICES_MODAL_ID}
              command="--show"
            >
              Apply prices to Shopify
            </s-button>
          </s-stack>
        ) : null}

      <s-table>
        <s-table-header-row>
          <s-table-header>
            <s-checkbox
              label="Select all apply-eligible results"
              labelAccessibilityVisibility="exclusive"
              checked={selectAllState.checked}
              indeterminate={selectAllState.indeterminate}
              disabled={eligibleIds.length === 0}
              onChange={(event: Event) => {
                onSelectAllChange(readChecked(event));
              }}
            />
          </s-table-header>
          <s-table-header listSlot="primary">Product / Variant</s-table-header>
          <s-table-header listSlot="labeled" format="currency">
            Current Price
          </s-table-header>
          <s-table-header listSlot="labeled" format="currency">
            Cost
          </s-table-header>
          <s-table-header listSlot="labeled" format="numeric">
            Current Margin
          </s-table-header>
          {strategyColumns.map((column) => (
            <s-table-header key={column.key} listSlot="labeled">
              {column.label}
            </s-table-header>
          ))}
          <s-table-header listSlot="labeled" format="currency">
            Simulated Price
          </s-table-header>
          <s-table-header listSlot="labeled" format="currency">
            Profit / Loss
          </s-table-header>
          <s-table-header listSlot="labeled" format="numeric">
            Margin
          </s-table-header>
        </s-table-header-row>
        <s-table-body>
          {rows.map(({ product, snapshot, simulation }) => (
            <ComparisonResultRow
              key={product.trackedProductId}
              product={product}
              snapshot={snapshot}
              simulation={simulation}
              strategyColumns={strategyColumns}
              selected={selectedIdSet.has(product.trackedProductId)}
              eligible={eligibleIdSet.has(product.trackedProductId)}
              onSelectedChange={onApplySelectionChange}
            />
          ))}
        </s-table-body>
      </s-table>
      </s-stack>
    </s-section>
  );
}

function ComparisonResultRow({
  product,
  snapshot,
  simulation,
  strategyColumns,
  selected,
  eligible,
  onSelectedChange,
}: {
  product: ComparisonProduct;
  snapshot: ComparisonSnapshot;
  simulation: ComparisonRowSimulation;
  strategyColumns: ComparisonStrategyColumn[];
  selected: boolean;
  eligible: boolean;
  onSelectedChange: (trackedProductId: string, checked: boolean) => void;
}) {
  const { simulatedOutcome, costReady, calculationsPaused } = simulation;

  return (
    <s-table-row>
      <s-table-cell>
        <s-checkbox
          label={`Apply ${product.title} simulated price to Shopify`}
          labelAccessibilityVisibility="exclusive"
          checked={selected}
          disabled={!eligible}
          onChange={(event: Event) => {
            onSelectedChange(product.trackedProductId, readChecked(event));
          }}
        />
      </s-table-cell>
      <s-table-cell>
        <s-stack direction="block" gap="small-200">
          <s-text type="strong">{product.title}</s-text>
          <s-text color="subdued">{snapshot.variantTitle}</s-text>
        </s-stack>
      </s-table-cell>
      <s-table-cell>
        {formatMoneyOrPlaceholder(snapshot.currentPrice, product.currency)}
      </s-table-cell>
      <s-table-cell>
        {formatMoneyOrPlaceholder(snapshot.effectiveCost, product.currency)}
      </s-table-cell>
      <s-table-cell>
        {formatCurrentComparisonMargin(
          snapshot.currentPrice,
          snapshot.effectiveCost,
        )}
      </s-table-cell>
      {strategyColumns.map((column) => (
        <s-table-cell key={column.key}>{column.displayValue}</s-table-cell>
      ))}
      <s-table-cell>
        {formatSimulatedPriceCell(
          simulatedOutcome.evaluatedSellingPrice,
          product.currency,
          costReady,
          calculationsPaused,
        )}
      </s-table-cell>
      <s-table-cell>
        {formatProfitLossCell(
          simulatedOutcome.profitLoss,
          simulatedOutcome.status,
          product.currency,
          costReady,
          calculationsPaused,
        )}
      </s-table-cell>
      <s-table-cell>
        {formatSimulatedMarginCell(
          simulatedOutcome.marginPercent,
          costReady,
          calculationsPaused,
        )}
      </s-table-cell>
    </s-table-row>
  );
}

function formatSimulatedPriceCell(
  amount: number | null,
  currency: string,
  costReady: boolean,
  calculationsPaused: boolean,
): string {
  if (!costReady || calculationsPaused) {
    return "—";
  }

  return formatComparisonSimulatedPrice(amount, currency);
}

function formatProfitLossCell(
  amount: number | null,
  status: OutcomeStatus | null,
  currency: string,
  costReady: boolean,
  calculationsPaused: boolean,
) {
  if (!costReady) {
    return <s-text color="subdued">{COMPARISON_COST_MISSING_LABEL}</s-text>;
  }

  if (calculationsPaused) {
    return "—";
  }

  return (
    <span style={profitValueStyle(status)}>
      {formatComparisonProfitLoss(amount, currency)}
    </span>
  );
}

function formatSimulatedMarginCell(
  marginPercent: number | null,
  costReady: boolean,
  calculationsPaused: boolean,
) {
  if (!costReady) {
    return <s-text color="subdued">{COMPARISON_COST_MISSING_LABEL}</s-text>;
  }

  if (calculationsPaused) {
    return "—";
  }

  return formatComparisonResultMargin(marginPercent);
}

function ComparisonApplyResultBanner({
  data,
}: {
  data: ApplyComparisonPricesActionData;
}) {
  if (data.ok) {
    return (
      <s-banner tone="success" heading="Shopify updated">
        <p>{data.message}</p>
      </s-banner>
    );
  }

  const failedRows = data.results.filter((result) => !result.ok);

  return (
    <s-banner tone="critical" heading="Could not update Shopify">
      <s-stack direction="block" gap="small-200">
        <p>{data.error}</p>
        {failedRows.map((row) => (
          <p key={`${row.trackedProductId}:${row.shopifyVariantId}`}>
            {row.productTitle} / {row.variantTitle}
            {row.error ? ` — ${row.error}` : ""}
          </p>
        ))}
      </s-stack>
    </s-banner>
  );
}

function noopSetSellingPrice() {}

const profitValueBaseStyle: CSSProperties = {
  fontWeight: 600,
};

function profitValueStyle(status: OutcomeStatus | null): CSSProperties {
  if (status === "Profit") {
    return {
      ...profitValueBaseStyle,
      color: "var(--p-color-text-success, #014b40)",
    };
  }
  if (status === "Loss") {
    return {
      ...profitValueBaseStyle,
      color: "var(--p-color-text-critical, #8e0b21)",
    };
  }
  return profitValueBaseStyle;
}
