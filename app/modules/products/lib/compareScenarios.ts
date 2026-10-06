import { formatCurrencyAmount } from "~/modules/cost-profiles/lib/formatCurrency";
import type { CostProfile } from "~/modules/cost-profiles/types/CostProfile";
import type { CostProfileMode } from "~/modules/cost-profiles/types/CostProfileMode";
import {
  categoryToCostItemType,
  type CostItemType,
} from "~/modules/cost-profiles/types/CostItemType";

import { normalizeShopMoneyAmount } from "./normalizeShopMoneyAmount";
import { hasProductCost } from "./productStatus";
import {
  EMPTY_STRATEGY_FIELDS,
  formatEvaluatedSellingPrice,
  formatMarginPercent,
  formatProfitLoss,
  simulateProjectedOutcome,
  type DiscountType,
  type ProjectedOutcome,
  type SimulationBaseline,
  type StrategyFieldMap,
  type StrategyInputs,
} from "./simulateProjectedOutcome";
import { getActiveStrategyIds, isCustomStrategyActive } from "./strategyActivation";
import { getStrategyDefinition, type StrategyId } from "./strategyCatalog";
import {
  validateStrategyBusinessRules,
  type StrategyBusinessValidation,
} from "./validateStrategyBusinessRules";
import { PRODUCT_LEVEL_VARIANT_ID } from "./variantContext";

export type ComparisonVariantSource = {
  id: string;
  title: string;
  price: string;
  unitCost: string | null;
};

export type ComparisonCostProfile = Pick<
  CostProfile,
  "shopifyVariantId" | "mode" | "totalCost" | "sellingPrice" | "items"
>;

export type ComparisonCostAmounts = Record<CostItemType, string>;

export type ComparisonVariantOption = {
  id: string;
  title: string;
  currentPrice: string | null;
  /** Live Shopify variant price from catalog enrichment — not CostProfile.sellingPrice. */
  shopifyPrice: string | null;
  shopifyUnitCost: string | null;
  effectiveCost: string | null;
  costReady: boolean;
  costMode: CostProfileMode | null;
  costAmounts: ComparisonCostAmounts;
  costProfileVariantId: string;
};

export type ComparisonProduct = {
  trackedProductId: string;
  title: string;
  imageUrl: string | null;
  imageAlt: string | null;
  currency: string;
  defaultVariantId: string | null;
  productLevelCost: string | null;
  productLevelSellingPrice: string | null;
  productLevelCostMode: CostProfileMode | null;
  productLevelCostAmounts: ComparisonCostAmounts;
  productLevelCostProfileVariantId: string;
  variants: ComparisonVariantOption[];
};

export type ComparisonSnapshot = {
  variantId: string | null;
  variantTitle: string;
  currentPrice: string | null;
  /** Live Shopify variant price from catalog enrichment — not CostProfile.sellingPrice. */
  shopifyPrice: string | null;
  effectiveCost: string | null;
  shopifyUnitCost: string | null;
  costReady: boolean;
  costMode: CostProfileMode | null;
  costAmounts: ComparisonCostAmounts;
  costProfileVariantId: string;
};

export type ComparisonReadinessSummary = {
  selectedCount: number;
  readyCount: number;
  needsCostCount: number;
};

export type RestoredComparisonState = {
  id: string;
  name: string;
  skippedUnavailableCount: number;
};

export type CompareScenariosPageData = {
  products: ComparisonProduct[];
  restoredComparison?: RestoredComparisonState;
};

export type ComparisonStrategyColumn = {
  key: string;
  label: string;
  displayValue: string;
};

export type ComparisonRowSimulation = {
  costReady: boolean;
  calculationsPaused: boolean;
  currentOutcome: ProjectedOutcome;
  simulatedOutcome: ProjectedOutcome;
  validation: StrategyBusinessValidation;
};

const EMPTY_PROJECTED_OUTCOME: ProjectedOutcome = {
  profitLoss: null,
  marginPercent: null,
  status: null,
  evaluatedTotalCost: null,
  evaluatedSellingPrice: null,
};

export const COMPARISON_COST_MISSING_LABEL = "Cost missing";

/**
 * Keep merchant selection order and drop IDs that are not in the
 * already shop-scoped result set.
 */
export function resolveShopScopedTrackedProducts<T extends { id: string }>(
  selectedIds: string[],
  trackedForShop: readonly T[],
): T[] {
  const byId = new Map(trackedForShop.map((product) => [product.id, product]));
  const resolved: T[] = [];
  const seen = new Set<string>();

  for (const selectedId of selectedIds) {
    const id = selectedId.trim();
    if (!id || seen.has(id)) {
      continue;
    }

    const product = byId.get(id);
    if (!product) {
      continue;
    }

    seen.add(id);
    resolved.push(product);
  }

  return resolved;
}

export function isReadyCostProfile(
  profile: ComparisonCostProfile,
): boolean {
  return (
    (profile.mode === "QUICK_START" || profile.mode === "DETAILED") &&
    hasProductCost(profile.totalCost)
  );
}

/**
 * Default active variant for comparison — one row per tracked product.
 * Prefers a persisted selection, then the sole ready variant, then the first variant.
 */
export function resolveDefaultComparisonVariantId(
  variants: readonly ComparisonVariantSource[],
  profiles: readonly ComparisonCostProfile[],
  persistedSelectedId: string | null | undefined,
): string | null {
  if (variants.length === 0) {
    return null;
  }

  if (variants.length === 1) {
    return variants[0].id;
  }

  const persisted = persistedSelectedId?.trim();
  if (persisted && variants.some((variant) => variant.id === persisted)) {
    return persisted;
  }

  const readyProfiles = profiles.filter(isReadyCostProfile);
  const legacyReady = readyProfiles.some(
    (profile) => profile.shopifyVariantId === PRODUCT_LEVEL_VARIANT_ID,
  );
  const variantReady = readyProfiles.filter(
    (profile) => profile.shopifyVariantId !== PRODUCT_LEVEL_VARIANT_ID,
  );

  if (variantReady.length === 1 && !legacyReady) {
    const readyVariantId = variantReady[0].shopifyVariantId;
    if (variants.some((variant) => variant.id === readyVariantId)) {
      return readyVariantId;
    }
  }

  return variants[0].id;
}

/**
 * Ready CostProfile that backs a comparison variant.
 * Same precedence as resolveEffectiveComparisonCost — never a sibling
 * variant, and never Shopify Cost per item.
 */
export function findActiveComparisonCostProfile(
  profiles: readonly ComparisonCostProfile[],
  shopifyVariantId: string | null,
  variantCount: number,
): ComparisonCostProfile | null {
  const readyProfiles = profiles.filter(isReadyCostProfile);
  const legacyProfile = readyProfiles.find(
    (profile) => profile.shopifyVariantId === PRODUCT_LEVEL_VARIANT_ID,
  );

  if (!shopifyVariantId) {
    return legacyProfile ?? null;
  }

  const variantProfile = profiles.find(
    (profile) => profile.shopifyVariantId === shopifyVariantId,
  );
  if (variantProfile && isReadyCostProfile(variantProfile)) {
    return variantProfile;
  }

  if (variantCount <= 1) {
    return legacyProfile ?? null;
  }

  const onlyLegacyReady =
    legacyProfile != null &&
    readyProfiles.every(
      (profile) => profile.shopifyVariantId === PRODUCT_LEVEL_VARIANT_ID,
    );

  return onlyLegacyReady ? legacyProfile : null;
}

/**
 * Effective ProfitPilot cost for a comparison variant.
 * Mirrors resolveProductDetailView precedence — never treats Shopify
 * Cost per item as simulator cost, and never treats missing cost as zero.
 */
export function resolveEffectiveComparisonCost(
  profiles: readonly ComparisonCostProfile[],
  shopifyVariantId: string | null,
  variantCount: number,
): string | null {
  return (
    findActiveComparisonCostProfile(profiles, shopifyVariantId, variantCount)
      ?.totalCost ?? null
  );
}

/**
 * Current Price for comparison: ProfitPilot selling price when set,
 * otherwise the Shopify variant price already shown in the table.
 * Edit Selling Price writes CostProfile.sellingPrice — not Shopify price.
 */
export function resolveComparisonCurrentPrice(
  profiles: readonly ComparisonCostProfile[],
  shopifyVariantId: string | null,
  variantCount: number,
  shopifyPrice: string | null | undefined,
): string | null {
  const sellingPrice = normalizeDisplayPrice(
    findActiveComparisonCostProfile(profiles, shopifyVariantId, variantCount)
      ?.sellingPrice,
  );

  return sellingPrice ?? normalizeDisplayPrice(shopifyPrice);
}

export function displayComparisonVariantTitle(
  title: string | null | undefined,
  variantCount: number,
): string {
  const trimmed = title?.trim() ?? "";

  if (variantCount <= 1) {
    return !trimmed || trimmed === "Default Title" ? "Default" : trimmed;
  }

  return trimmed || "Default";
}

export function buildComparisonProduct(input: {
  trackedProductId: string;
  title: string;
  imageUrl: string | null;
  imageAlt: string | null;
  currency: string;
  variants: readonly ComparisonVariantSource[];
  profiles: readonly ComparisonCostProfile[];
  selectedShopifyVariantId: string | null;
}): ComparisonProduct {
  const defaultVariantId = resolveDefaultComparisonVariantId(
    input.variants,
    input.profiles,
    input.selectedShopifyVariantId,
  );
  const productLevelProfile = findActiveComparisonCostProfile(
    input.profiles,
    null,
    0,
  );

  return {
    trackedProductId: input.trackedProductId,
    title: input.title,
    imageUrl: input.imageUrl,
    imageAlt: input.imageAlt,
    currency: input.currency,
    defaultVariantId,
    productLevelCost: productLevelProfile?.totalCost ?? null,
    productLevelSellingPrice: normalizeDisplayPrice(
      productLevelProfile?.sellingPrice,
    ),
    productLevelCostMode: productLevelProfile?.mode ?? null,
    productLevelCostAmounts: costAmountsFromProfile(productLevelProfile),
    productLevelCostProfileVariantId:
      productLevelProfile?.shopifyVariantId ?? PRODUCT_LEVEL_VARIANT_ID,
    variants: input.variants.map((variant) => {
      const profile = findActiveComparisonCostProfile(
        input.profiles,
        variant.id,
        input.variants.length,
      );
      const effectiveCost = profile?.totalCost ?? null;

      return {
        id: variant.id,
        title: displayComparisonVariantTitle(
          variant.title,
          input.variants.length,
        ),
        currentPrice: resolveComparisonCurrentPrice(
          input.profiles,
          variant.id,
          input.variants.length,
          variant.price,
        ),
        shopifyPrice: normalizeDisplayPrice(variant.price),
        shopifyUnitCost: normalizeShopMoneyAmount(variant.unitCost),
        effectiveCost,
        costReady: effectiveCost != null,
        costMode: profile?.mode ?? null,
        costAmounts: costAmountsFromProfile(profile),
        costProfileVariantId: profile?.shopifyVariantId ?? variant.id,
      };
    }),
  };
}

export function resolveActiveComparisonSnapshot(
  product: ComparisonProduct,
  selectedVariantId?: string | null,
): ComparisonSnapshot {
  const selected = selectedVariantId?.trim();
  const variant =
    (selected
      ? product.variants.find((item) => item.id === selected)
      : undefined) ??
    (product.defaultVariantId
      ? product.variants.find((item) => item.id === product.defaultVariantId)
      : undefined) ??
    product.variants[0] ??
    null;

  if (!variant) {
    return {
      variantId: null,
      variantTitle: "Default",
      currentPrice: product.productLevelSellingPrice,
      shopifyPrice: null,
      effectiveCost: product.productLevelCost,
      shopifyUnitCost: null,
      costReady: product.productLevelCost != null,
      costMode: product.productLevelCostMode,
      costAmounts: product.productLevelCostAmounts,
      costProfileVariantId: product.productLevelCostProfileVariantId,
    };
  }

  return {
    variantId: variant.id,
    variantTitle: variant.title,
    currentPrice: variant.currentPrice,
    shopifyPrice: variant.shopifyPrice,
    effectiveCost: variant.effectiveCost,
    shopifyUnitCost: variant.shopifyUnitCost,
    costReady: variant.costReady,
    costMode: variant.costMode,
    costAmounts: variant.costAmounts,
    costProfileVariantId: variant.costProfileVariantId,
  };
}

export function summarizeComparisonReadiness(
  snapshots: readonly { costReady: boolean }[],
): ComparisonReadinessSummary {
  const readyCount = snapshots.filter((item) => item.costReady).length;

  return {
    selectedCount: snapshots.length,
    readyCount,
    needsCostCount: snapshots.length - readyCount,
  };
}

export function formatComparisonSelectionSummary(selectedCount: number): string {
  return selectedCount === 1
    ? "1 product selected"
    : `${selectedCount} products selected`;
}

export function formatComparisonReadinessSummary(
  readyCount: number,
  needsCostCount: number,
): string {
  const needsLabel = needsCostCount === 1 ? "needs" : "need";
  return `${readyCount} ready · ${needsCostCount} ${needsLabel} cost`;
}

/**
 * Current (no-strategy) outcome using the existing simulator pipeline.
 */
export function computeCurrentProjectedOutcome(baseline: SimulationBaseline) {
  return simulateProjectedOutcome(baseline, {
    activeIds: [],
    fields: EMPTY_STRATEGY_FIELDS,
    customStrategies: [],
  });
}

export function formatCurrentComparisonMargin(
  sellingPrice: string | null,
  totalCost: string | null,
): string {
  return formatMarginPercent(
    computeCurrentProjectedOutcome({ sellingPrice, totalCost }).marginPercent,
  );
}

export function compareAddCostModalId(trackedProductId: string): string {
  return `compare-add-cost-${trackedProductId}`;
}

export function compareEditPriceModalId(trackedProductId: string): string {
  return `compare-edit-price-${trackedProductId}`;
}

export function compareEditDetailedCostModalId(
  trackedProductId: string,
): string {
  return `compare-edit-detailed-cost-${trackedProductId}`;
}

export function toComparisonSimulationBaseline(
  snapshot: Pick<ComparisonSnapshot, "currentPrice" | "effectiveCost">,
): SimulationBaseline {
  return {
    sellingPrice: snapshot.currentPrice,
    totalCost: snapshot.effectiveCost,
  };
}

/**
 * Apply the existing single-product simulator to one comparison row.
 * Missing cost never fabricates profit/margin and never blocks other rows.
 */
export function simulateComparisonRow(
  baseline: SimulationBaseline,
  strategies: StrategyInputs,
  options?: { costReady?: boolean },
): ComparisonRowSimulation {
  const costReady =
    options?.costReady ??
    (baseline.totalCost != null && baseline.totalCost.trim() !== "");
  const currentOutcome = computeCurrentProjectedOutcome(baseline);
  const validation = validateStrategyBusinessRules(baseline, strategies);

  if (!costReady) {
    return {
      costReady: false,
      calculationsPaused: false,
      currentOutcome,
      simulatedOutcome: simulateProjectedOutcome(baseline, strategies),
      validation,
    };
  }

  if (validation.hasBlockingError) {
    return {
      costReady: true,
      calculationsPaused: true,
      currentOutcome,
      simulatedOutcome: EMPTY_PROJECTED_OUTCOME,
      validation,
    };
  }

  return {
    costReady: true,
    calculationsPaused: false,
    currentOutcome,
    simulatedOutcome: simulateProjectedOutcome(baseline, strategies),
    validation,
  };
}

/**
 * Shared Decision Strategies field errors: only messages that apply to every
 * product that has a selling price. Product-specific blocks stay on that row.
 */
export function aggregateSharedStrategyValidation(
  validations: readonly StrategyBusinessValidation[],
): Pick<
  StrategyBusinessValidation,
  "errors" | "warnings" | "customStrategyErrors"
> {
  if (validations.length === 0) {
    return { errors: {}, warnings: {}, customStrategyErrors: {} };
  }

  const errors: Partial<Record<StrategyId, string>> = {};
  const warnings: Partial<Record<StrategyId, string>> = {};
  const customStrategyErrors: Record<string, string> = {};

  const first = validations[0];
  for (const strategyId of Object.keys(first.errors) as StrategyId[]) {
    const message = first.errors[strategyId];
    if (
      message &&
      validations.every((item) => item.errors[strategyId] === message)
    ) {
      errors[strategyId] = message;
    }
  }

  for (const strategyId of Object.keys(first.warnings) as StrategyId[]) {
    const message = first.warnings[strategyId];
    if (
      message &&
      validations.every((item) => item.warnings[strategyId] === message)
    ) {
      warnings[strategyId] = message;
    }
  }

  for (const customId of Object.keys(first.customStrategyErrors)) {
    const message = first.customStrategyErrors[customId];
    if (
      message &&
      validations.every((item) => item.customStrategyErrors[customId] === message)
    ) {
      customStrategyErrors[customId] = message;
    }
  }

  return { errors, warnings, customStrategyErrors };
}

export function listActiveComparisonStrategyColumns(
  strategies: StrategyInputs,
  currency: string,
): ComparisonStrategyColumn[] {
  const catalogColumns = getActiveStrategyIds(strategies).map((strategyId) => ({
    key: strategyId,
    label: getStrategyDefinition(strategyId).label,
    displayValue: formatComparisonStrategyColumnValue(
      strategyId,
      strategies.fields,
      currency,
    ),
  }));

  const customColumns = strategies.customStrategies
    .filter((strategy) => isCustomStrategyActive(strategy))
    .map((strategy) => ({
      key: strategy.id,
      label: strategy.name,
      displayValue: formatDiscountLikeColumnValue(
        strategy.type,
        strategy.value,
        currency,
      ),
    }));

  return [...catalogColumns, ...customColumns];
}

export function formatComparisonStrategyColumnValue(
  strategyId: StrategyId,
  fields: StrategyFieldMap,
  currency: string,
): string {
  switch (strategyId) {
    case "discount":
      return formatDiscountLikeColumnValue(
        fields.discount.type,
        fields.discount.value,
        currency,
      );
    case "free_shipping":
      return formatOptionalMoneyColumnValue(
        fields.free_shipping.shippingCost,
        currency,
      );
    case "bundle_offer":
      return formatOptionalMoneyColumnValue(
        fields.bundle_offer.bundlePrice,
        currency,
      );
    case "coupon":
      return formatDiscountLikeColumnValue(
        fields.coupon.type,
        fields.coupon.value,
        currency,
      );
    case "cashback":
      return formatDiscountLikeColumnValue(
        fields.cashback.type,
        fields.cashback.value,
        currency,
      );
    case "buy_x_get_y":
      return `Buy ${fields.buy_x_get_y.buyQty.trim()} Get ${fields.buy_x_get_y.getQty.trim()}`;
    case "flash_sale":
      return formatPercentColumnValue(fields.flash_sale.percentOff);
    case "referral_bonus":
      return formatOptionalMoneyColumnValue(
        fields.referral_bonus.amount,
        currency,
      );
    case "quantity_discount":
      return formatDiscountLikeColumnValue(
        fields.quantity_discount.type,
        fields.quantity_discount.value,
        currency,
      );
    case "gift_with_purchase":
      return formatOptionalMoneyColumnValue(
        fields.gift_with_purchase.giftCost,
        currency,
      );
    case "loyalty_reward":
      return formatPercentColumnValue(fields.loyalty_reward.percent);
  }
}

export function formatComparisonSimulatedPrice(
  amount: number | null,
  currency: string,
): string {
  const formatted = formatEvaluatedSellingPrice(amount);
  return formatted != null ? formatCurrencyAmount(formatted, currency) : "—";
}

export function formatComparisonProfitLoss(
  amount: number | null,
  currency: string,
): string {
  return formatProfitLoss(amount, currency);
}

export function formatComparisonResultMargin(
  marginPercent: number | null,
): string {
  return formatMarginPercent(marginPercent);
}

function formatDiscountLikeColumnValue(
  type: DiscountType,
  value: string,
  currency: string,
): string {
  const trimmed = value.trim();
  if (trimmed === "") {
    return "—";
  }

  if (type === "percentage") {
    return formatPercentColumnValue(trimmed);
  }

  return `${formatCurrencyAmount(trimmed, currency)} fixed`;
}

function formatPercentColumnValue(value: string): string {
  const trimmed = value.trim();
  return trimmed === "" ? "—" : `${trimmed}%`;
}

function formatOptionalMoneyColumnValue(
  value: string,
  currency: string,
): string {
  const trimmed = value.trim();
  return trimmed === "" ? "—" : formatCurrencyAmount(trimmed, currency);
}

function normalizeDisplayPrice(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

function emptyCostAmounts(): ComparisonCostAmounts {
  return {
    PURCHASE: "",
    PACKAGING: "",
    SHIPPING: "",
    PAYMENT_FEES: "",
    OTHER: "",
  };
}

function costAmountsFromProfile(
  profile: ComparisonCostProfile | null,
): ComparisonCostAmounts {
  const amounts = emptyCostAmounts();
  if (!profile) {
    return amounts;
  }

  for (const item of profile.items) {
    const type = categoryToCostItemType(item.category);
    if (amounts[type] === "") {
      amounts[type] = item.value;
    }
  }

  return amounts;
}
