import { validateQuickStartTotalCost } from "~/modules/cost-profiles/lib/validateQuickStartTotalCost";

import {
  formatComparisonSelectionSummary,
  resolveActiveComparisonSnapshot,
  simulateComparisonRow,
  toComparisonSimulationBaseline,
  type ComparisonProduct,
  type ComparisonRowSimulation,
  type ComparisonSnapshot,
} from "./compareScenarios";
import {
  EMPTY_STRATEGY_FIELDS,
  formatEvaluatedSellingPrice,
  type CustomStrategyInstance,
  type DiscountType,
  type StrategyFieldMap,
  type StrategyInputs,
} from "./simulateProjectedOutcome";
import { STRATEGY_IDS, type StrategyId } from "./strategyCatalog";

export const APPLY_COMPARISON_PRICES_INTENT = "apply-comparison-prices";

export const APPLY_COMPARISON_PRICES_MODAL_ID =
  "apply-comparison-prices-modal";

export type ComparisonApplySelection = {
  trackedProductId: string;
  shopifyVariantId: string;
};

export type ComparisonApplyConfirmationRow = {
  trackedProductId: string;
  shopifyVariantId: string;
  productTitle: string;
  variantTitle: string;
  currency: string;
  currentShopifyPrice: string | null;
  newPrice: string;
};

export type ComparisonApplyRowIdentity = {
  trackedProductId: string;
  shopifyVariantId: string;
  productTitle: string;
  variantTitle: string;
};

export type ComparisonApplyRowResult = ComparisonApplyRowIdentity & {
  ok: boolean;
  error?: string;
};

export type ApplyComparisonPricesActionData =
  | {
      ok: true;
      appliedCount: number;
      failedCount: 0;
      results: ComparisonApplyRowResult[];
      message: string;
    }
  | {
      ok: false;
      appliedCount: number;
      failedCount: number;
      results: ComparisonApplyRowResult[];
      error: string;
    };

export type VerifiedComparisonApplyRow = ComparisonApplyRowIdentity & {
  shopifyProductId: string;
  newPrice: string;
};

type ComparisonApplyEligibilityInput = {
  variantId: string | null;
  costReady: boolean;
  calculationsPaused: boolean;
  evaluatedSellingPrice: number | null;
  effectiveCost: string | null;
};

/**
 * A comparison result row may be selected for Shopify apply only when the
 * existing single-product apply requirements are met and a valid simulated
 * selling price exists.
 */
export function isComparisonRowApplyEligible(
  input: ComparisonApplyEligibilityInput,
): boolean {
  if (!input.variantId?.trim()) {
    return false;
  }

  if (!input.costReady || input.calculationsPaused) {
    return false;
  }

  if (formatEvaluatedSellingPrice(input.evaluatedSellingPrice) == null) {
    return false;
  }

  if (
    input.effectiveCost == null ||
    !validateQuickStartTotalCost(input.effectiveCost).ok
  ) {
    return false;
  }

  return true;
}

export function isSimulatedComparisonRowApplyEligible(input: {
  snapshot: Pick<
    ComparisonSnapshot,
    "variantId" | "costReady" | "effectiveCost"
  >;
  simulation: Pick<
    ComparisonRowSimulation,
    "calculationsPaused" | "simulatedOutcome"
  >;
}): boolean {
  return isComparisonRowApplyEligible({
    variantId: input.snapshot.variantId,
    costReady: input.snapshot.costReady,
    calculationsPaused: input.simulation.calculationsPaused,
    evaluatedSellingPrice:
      input.simulation.simulatedOutcome.evaluatedSellingPrice,
    effectiveCost: input.snapshot.effectiveCost,
  });
}

/**
 * Canonical Shopify selling price for a comparison row — the existing
 * simulator output, never a fabricated or client-supplied amount.
 */
export function resolveCanonicalComparisonApplyPrice(
  simulation: Pick<
    ComparisonRowSimulation,
    "calculationsPaused" | "simulatedOutcome" | "costReady"
  >,
  snapshot: Pick<ComparisonSnapshot, "variantId" | "costReady" | "effectiveCost">,
): string | null {
  if (
    !isComparisonRowApplyEligible({
      variantId: snapshot.variantId,
      costReady: snapshot.costReady,
      calculationsPaused: simulation.calculationsPaused,
      evaluatedSellingPrice: simulation.simulatedOutcome.evaluatedSellingPrice,
      effectiveCost: snapshot.effectiveCost,
    })
  ) {
    return null;
  }

  return formatEvaluatedSellingPrice(
    simulation.simulatedOutcome.evaluatedSellingPrice,
  );
}

export function listEligibleComparisonApplyIds(
  rows: readonly {
    product: Pick<ComparisonProduct, "trackedProductId">;
    snapshot: Pick<
      ComparisonSnapshot,
      "variantId" | "costReady" | "effectiveCost"
    >;
    simulation: Pick<
      ComparisonRowSimulation,
      "calculationsPaused" | "simulatedOutcome"
    >;
  }[],
): string[] {
  return rows
    .filter((row) => isSimulatedComparisonRowApplyEligible(row))
    .map((row) => row.product.trackedProductId);
}

export function filterSelectedComparisonApplyIds(
  selectedIds: readonly string[],
  eligibleIds: readonly string[],
): string[] {
  const eligible = new Set(eligibleIds);
  return selectedIds.filter((id) => eligible.has(id));
}

export function comparisonApplySelectAllState(
  eligibleIds: readonly string[],
  selectedIds: readonly string[],
): { checked: boolean; indeterminate: boolean } {
  if (eligibleIds.length === 0) {
    return { checked: false, indeterminate: false };
  }

  const selected = new Set(selectedIds);
  const selectedEligibleCount = eligibleIds.filter((id) =>
    selected.has(id),
  ).length;

  return {
    checked: selectedEligibleCount === eligibleIds.length,
    indeterminate:
      selectedEligibleCount > 0 && selectedEligibleCount < eligibleIds.length,
  };
}

export function nextComparisonApplySelectionAfterSelectAll(
  eligibleIds: readonly string[],
  selectAllChecked: boolean,
): string[] {
  return selectAllChecked ? [...eligibleIds] : [];
}

export function toggleComparisonApplySelection(
  selectedIds: readonly string[],
  trackedProductId: string,
  checked: boolean,
  eligibleIds: readonly string[],
): string[] {
  if (!eligibleIds.includes(trackedProductId)) {
    return filterSelectedComparisonApplyIds(selectedIds, eligibleIds);
  }

  const next = new Set(
    filterSelectedComparisonApplyIds(selectedIds, eligibleIds),
  );

  if (checked) {
    next.add(trackedProductId);
  } else {
    next.delete(trackedProductId);
  }

  return [...next];
}

export function shouldShowComparisonApplyAction(
  selectedCount: number,
): boolean {
  return selectedCount > 0;
}

export function formatComparisonApplySelectionLabel(
  selectedCount: number,
): string {
  return formatComparisonSelectionSummary(selectedCount);
}

export function formatComparisonApplyConfirmHeading(
  variantCount: number,
): string {
  return variantCount === 1
    ? "Apply simulated prices to 1 Shopify variant?"
    : `Apply simulated prices to ${variantCount} Shopify variants?`;
}

export function formatComparisonApplyResultMessage(
  appliedCount: number,
  failedCount: number,
): string {
  if (appliedCount > 0 && failedCount === 0) {
    return appliedCount === 1
      ? "1 price applied to Shopify."
      : `${appliedCount} prices applied to Shopify.`;
  }

  if (appliedCount > 0 && failedCount > 0) {
    const applied =
      appliedCount === 1
        ? "1 price applied"
        : `${appliedCount} prices applied`;
    const failed =
      failedCount === 1 ? "1 price failed" : `${failedCount} prices failed`;
    return `${applied}. ${failed}.`;
  }

  return failedCount === 1
    ? "1 price failed. No Shopify prices were updated."
    : `${failedCount} prices failed. No Shopify prices were updated.`;
}

export function canSubmitComparisonApply(
  isSubmitting: boolean,
  selectedCount: number,
): boolean {
  return !isSubmitting && selectedCount > 0;
}

export function buildComparisonApplyConfirmationRows(
  rows: readonly {
    product: ComparisonProduct;
    snapshot: ComparisonSnapshot;
    simulation: ComparisonRowSimulation;
  }[],
  selectedIds: readonly string[],
): ComparisonApplyConfirmationRow[] {
  const selected = new Set(selectedIds);
  const confirmation: ComparisonApplyConfirmationRow[] = [];

  for (const row of rows) {
    if (!selected.has(row.product.trackedProductId)) {
      continue;
    }

    const newPrice = resolveCanonicalComparisonApplyPrice(
      row.simulation,
      row.snapshot,
    );
    if (newPrice == null || row.snapshot.variantId == null) {
      continue;
    }

    confirmation.push({
      trackedProductId: row.product.trackedProductId,
      shopifyVariantId: row.snapshot.variantId,
      productTitle: row.product.title,
      variantTitle: row.snapshot.variantTitle,
      currency: row.product.currency,
      currentShopifyPrice: row.snapshot.shopifyPrice,
      newPrice,
    });
  }

  return confirmation;
}

export function buildComparisonApplySelections(
  confirmationRows: readonly ComparisonApplyConfirmationRow[],
): ComparisonApplySelection[] {
  return confirmationRows.map((row) => ({
    trackedProductId: row.trackedProductId,
    shopifyVariantId: row.shopifyVariantId,
  }));
}

export function buildComparisonApplyFormPayload(
  selections: readonly ComparisonApplySelection[],
  strategies: StrategyInputs,
): Record<string, string> {
  return {
    intent: APPLY_COMPARISON_PRICES_INTENT,
    selections: JSON.stringify(selections),
    strategies: JSON.stringify(strategies),
  };
}

export function parseComparisonApplySelections(
  raw: unknown,
): ComparisonApplySelection[] | null {
  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }

  const selections: ComparisonApplySelection[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (item == null || typeof item !== "object") {
      return null;
    }

    const record = item as Record<string, unknown>;
    const trackedProductId =
      typeof record.trackedProductId === "string"
        ? record.trackedProductId.trim()
        : "";
    const shopifyVariantId =
      typeof record.shopifyVariantId === "string"
        ? record.shopifyVariantId.trim()
        : "";

    if (!trackedProductId || !shopifyVariantId) {
      return null;
    }

    if (seen.has(trackedProductId)) {
      continue;
    }

    seen.add(trackedProductId);
    selections.push({ trackedProductId, shopifyVariantId });
  }

  return selections.length > 0 ? selections : null;
}

export function parseComparisonApplyStrategies(
  raw: unknown,
): StrategyInputs | null {
  if (raw == null || typeof raw !== "object") {
    return null;
  }

  const input = raw as Record<string, unknown>;
  if (!Array.isArray(input.activeIds)) {
    return null;
  }

  const activeIds: StrategyId[] = [];
  for (const id of input.activeIds) {
    if (!isStrategyId(id)) {
      return null;
    }

    if (!activeIds.includes(id)) {
      activeIds.push(id);
    }
  }

  const fields = parseStrategyFields(input.fields);
  if (fields == null) {
    return null;
  }

  const customStrategies = parseCustomStrategies(input.customStrategies);
  if (customStrategies == null) {
    return null;
  }

  return { activeIds, fields, customStrategies };
}

export function readComparisonApplyFormData(formData: FormData):
  | { ok: true; selections: ComparisonApplySelection[]; strategies: StrategyInputs }
  | { ok: false; error: string } {
  const selections = parseJsonField(
    formData.get("selections"),
    parseComparisonApplySelections,
  );
  const strategies = parseJsonField(
    formData.get("strategies"),
    parseComparisonApplyStrategies,
  );

  if (selections == null || strategies == null) {
    return {
      ok: false,
      error: "We couldn't update Shopify. Try again.",
    };
  }

  return { ok: true, selections, strategies };
}

/**
 * Shop-scoped comparison data + submitted variant + shared strategies must
 * reproduce a canonical simulated price before Shopify is mutated.
 */
export function verifyComparisonApplySelection(input: {
  products: readonly ComparisonProduct[];
  selection: ComparisonApplySelection;
  strategies: StrategyInputs;
}):
  | {
      ok: true;
      confirmation: ComparisonApplyConfirmationRow;
    }
  | {
      ok: false;
      identity: ComparisonApplyRowIdentity;
      error: string;
    } {
  const product = input.products.find(
    (item) => item.trackedProductId === input.selection.trackedProductId,
  );

  if (!product) {
    return {
      ok: false,
      identity: {
        trackedProductId: input.selection.trackedProductId,
        shopifyVariantId: input.selection.shopifyVariantId,
        productTitle: "Unknown product",
        variantTitle: "Unknown variant",
      },
      error: "We couldn't update Shopify. Try again.",
    };
  }

  const belongsToProduct = product.variants.some(
    (variant) => variant.id === input.selection.shopifyVariantId,
  );

  if (!belongsToProduct) {
    return {
      ok: false,
      identity: {
        trackedProductId: product.trackedProductId,
        shopifyVariantId: input.selection.shopifyVariantId,
        productTitle: product.title,
        variantTitle: "Unknown variant",
      },
      error: "The selected variant does not belong to this product.",
    };
  }

  const snapshot = resolveActiveComparisonSnapshot(
    product,
    input.selection.shopifyVariantId,
  );

  if (snapshot.variantId !== input.selection.shopifyVariantId) {
    return {
      ok: false,
      identity: {
        trackedProductId: product.trackedProductId,
        shopifyVariantId: input.selection.shopifyVariantId,
        productTitle: product.title,
        variantTitle: snapshot.variantTitle,
      },
      error: "The selected variant does not belong to this product.",
    };
  }

  const simulation = simulateComparisonRow(
    toComparisonSimulationBaseline(snapshot),
    input.strategies,
    { costReady: snapshot.costReady },
  );
  const newPrice = resolveCanonicalComparisonApplyPrice(simulation, snapshot);

  if (newPrice == null) {
    return {
      ok: false,
      identity: {
        trackedProductId: product.trackedProductId,
        shopifyVariantId: snapshot.variantId,
        productTitle: product.title,
        variantTitle: snapshot.variantTitle,
      },
      error: snapshot.costReady
        ? "Set a selling price before applying changes to Shopify."
        : "Add product cost before applying changes to Shopify.",
    };
  }

  return {
    ok: true,
    confirmation: {
      trackedProductId: product.trackedProductId,
      shopifyVariantId: snapshot.variantId,
      productTitle: product.title,
      variantTitle: snapshot.variantTitle,
      currency: product.currency,
      currentShopifyPrice: snapshot.shopifyPrice,
      newPrice,
    },
  };
}

export async function applyComparisonPriceRowsSequentially(
  rows: readonly VerifiedComparisonApplyRow[],
  updatePrice: (input: {
    shopifyProductId: string;
    shopifyVariantId: string;
    price: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>,
): Promise<ApplyComparisonPricesActionData> {
  const results: ComparisonApplyRowResult[] = [];

  for (const row of rows) {
    try {
      const updated = await updatePrice({
        shopifyProductId: row.shopifyProductId,
        shopifyVariantId: row.shopifyVariantId,
        price: row.newPrice,
      });

      if (updated.ok) {
        results.push({
          trackedProductId: row.trackedProductId,
          shopifyVariantId: row.shopifyVariantId,
          productTitle: row.productTitle,
          variantTitle: row.variantTitle,
          ok: true,
        });
        continue;
      }

      results.push({
        trackedProductId: row.trackedProductId,
        shopifyVariantId: row.shopifyVariantId,
        productTitle: row.productTitle,
        variantTitle: row.variantTitle,
        ok: false,
        error: updated.error,
      });
    } catch {
      results.push({
        trackedProductId: row.trackedProductId,
        shopifyVariantId: row.shopifyVariantId,
        productTitle: row.productTitle,
        variantTitle: row.variantTitle,
        ok: false,
        error: "Shopify could not update the selling price. Try again.",
      });
    }
  }

  return summarizeComparisonApplyResults(results);
}

export function summarizeComparisonApplyResults(
  results: readonly ComparisonApplyRowResult[],
): ApplyComparisonPricesActionData {
  const appliedCount = results.filter((result) => result.ok).length;
  const failedCount = results.length - appliedCount;
  const message = formatComparisonApplyResultMessage(appliedCount, failedCount);

  if (failedCount === 0 && appliedCount > 0) {
    return {
      ok: true,
      appliedCount,
      failedCount: 0,
      results: [...results],
      message,
    };
  }

  return {
    ok: false,
    appliedCount,
    failedCount,
    results: [...results],
    error: message,
  };
}

export function successfulComparisonApplyIds(
  results: readonly ComparisonApplyRowResult[],
): string[] {
  return results
    .filter((result) => result.ok)
    .map((result) => result.trackedProductId);
}

export function clearSuccessfulComparisonApplySelection(
  selectedIds: readonly string[],
  results: readonly ComparisonApplyRowResult[],
): string[] {
  const succeeded = new Set(successfulComparisonApplyIds(results));
  return selectedIds.filter((id) => !succeeded.has(id));
}

export function failedComparisonApplyResults(
  results: readonly ComparisonApplyRowResult[],
): ComparisonApplyRowResult[] {
  return results.filter((result) => !result.ok);
}

function parseJsonField<T>(
  raw: FormDataEntryValue | null,
  parse: (value: unknown) => T | null,
): T | null {
  if (typeof raw !== "string") {
    return null;
  }

  try {
    return parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

function isStrategyId(value: unknown): value is StrategyId {
  return (
    typeof value === "string" &&
    (STRATEGY_IDS as readonly string[]).includes(value)
  );
}

function parseDiscountType(value: unknown): DiscountType | null {
  return value === "percentage" || value === "fixed" ? value : null;
}

function parseStringField(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseStrategyFields(raw: unknown): StrategyFieldMap | null {
  if (raw == null) {
    return { ...EMPTY_STRATEGY_FIELDS };
  }

  if (typeof raw !== "object") {
    return null;
  }

  const input = raw as Record<string, unknown>;
  const discount = parseRecord(input.discount);
  const freeShipping = parseRecord(input.free_shipping);
  const bundleOffer = parseRecord(input.bundle_offer);
  const coupon = parseRecord(input.coupon);
  const cashback = parseRecord(input.cashback);
  const buyXGetY = parseRecord(input.buy_x_get_y);
  const flashSale = parseRecord(input.flash_sale);
  const referralBonus = parseRecord(input.referral_bonus);
  const quantityDiscount = parseRecord(input.quantity_discount);
  const giftWithPurchase = parseRecord(input.gift_with_purchase);
  const loyaltyReward = parseRecord(input.loyalty_reward);

  if (
    discount == null ||
    freeShipping == null ||
    bundleOffer == null ||
    coupon == null ||
    cashback == null ||
    buyXGetY == null ||
    flashSale == null ||
    referralBonus == null ||
    quantityDiscount == null ||
    giftWithPurchase == null ||
    loyaltyReward == null
  ) {
    return null;
  }

  const discountType =
    parseDiscountType(discount.type) ?? EMPTY_STRATEGY_FIELDS.discount.type;
  const couponType =
    parseDiscountType(coupon.type) ?? EMPTY_STRATEGY_FIELDS.coupon.type;
  const cashbackType =
    parseDiscountType(cashback.type) ?? EMPTY_STRATEGY_FIELDS.cashback.type;
  const quantityType =
    parseDiscountType(quantityDiscount.type) ??
    EMPTY_STRATEGY_FIELDS.quantity_discount.type;

  if (
    (discount.type != null && parseDiscountType(discount.type) == null) ||
    (coupon.type != null && parseDiscountType(coupon.type) == null) ||
    (cashback.type != null && parseDiscountType(cashback.type) == null) ||
    (quantityDiscount.type != null &&
      parseDiscountType(quantityDiscount.type) == null)
  ) {
    return null;
  }

  return {
    discount: {
      type: discountType,
      value: parseStringField(discount.value) ?? "",
    },
    free_shipping: {
      enabled: freeShipping.enabled === true,
      shippingCost: parseStringField(freeShipping.shippingCost) ?? "",
    },
    bundle_offer: {
      bundlePrice: parseStringField(bundleOffer.bundlePrice) ?? "",
    },
    coupon: {
      type: couponType,
      value: parseStringField(coupon.value) ?? "",
    },
    cashback: {
      type: cashbackType,
      value: parseStringField(cashback.value) ?? "",
    },
    buy_x_get_y: {
      buyQty: parseStringField(buyXGetY.buyQty) ?? "",
      getQty: parseStringField(buyXGetY.getQty) ?? "",
    },
    flash_sale: {
      percentOff: parseStringField(flashSale.percentOff) ?? "",
    },
    referral_bonus: {
      amount: parseStringField(referralBonus.amount) ?? "",
    },
    quantity_discount: {
      minQuantity: parseStringField(quantityDiscount.minQuantity) ?? "",
      type: quantityType,
      value: parseStringField(quantityDiscount.value) ?? "",
      simulatedQuantity:
        parseStringField(quantityDiscount.simulatedQuantity) ?? "",
    },
    gift_with_purchase: {
      giftCost: parseStringField(giftWithPurchase.giftCost) ?? "",
    },
    loyalty_reward: {
      percent: parseStringField(loyaltyReward.percent) ?? "",
    },
  };
}

function parseCustomStrategies(
  raw: unknown,
): CustomStrategyInstance[] | null {
  if (raw == null) {
    return [];
  }

  if (!Array.isArray(raw)) {
    return null;
  }

  const customStrategies: CustomStrategyInstance[] = [];

  for (const item of raw) {
    if (item == null || typeof item !== "object") {
      return null;
    }

    const record = item as Record<string, unknown>;
    const id = parseStringField(record.id)?.trim() ?? "";
    const name = parseStringField(record.name) ?? "";
    const type = parseDiscountType(record.type);
    const value = parseStringField(record.value);

    if (!id || type == null || value == null) {
      return null;
    }

    customStrategies.push({ id, name, type, value });
  }

  return customStrategies;
}

function parseRecord(raw: unknown): Record<string, unknown> | null {
  if (raw == null) {
    return {};
  }

  if (typeof raw !== "object") {
    return null;
  }

  return raw as Record<string, unknown>;
}
