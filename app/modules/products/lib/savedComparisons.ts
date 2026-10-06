import type { ComparisonProduct } from "./compareScenarios";

export const SAVE_COMPARISON_INTENT = "save-comparison";
export const RENAME_SAVED_COMPARISON_INTENT = "rename-saved-comparison";
export const DELETE_SAVED_COMPARISON_INTENT = "delete-saved-comparison";

export const SAVE_COMPARISON_MODAL_ID = "save-comparison-modal";
export const RENAME_SAVED_COMPARISON_MODAL_ID = "rename-saved-comparison-modal";
export const DELETE_SAVED_COMPARISON_MODAL_ID = "delete-saved-comparison-modal";

export const SAVED_COMPARISON_PARAM = "saved";
export const SAVED_COMPARISON_NAME_MAX_LENGTH = 80;

export type SavedComparisonItemInput = {
  trackedProductId: string;
  shopifyVariantId: string;
};

export type SavedComparisonPersistPayload = {
  name: string;
  items: Array<{
    trackedProductId: string;
    shopifyVariantId: string;
    position: number;
  }>;
};

export type SavedComparisonSummary = {
  id: string;
  name: string;
  productCount: number;
};

export type SavedComparisonMutationKind = "create" | "rename" | "delete";

export type SavedComparisonActionData =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Only explicit Save / Rename / Delete write SavedComparison rows.
 * Simulation, apply-to-Shopify, and cost/price edits must return null.
 */
export function savedComparisonMutationKind(
  intent: string,
): SavedComparisonMutationKind | null {
  switch (intent) {
    case SAVE_COMPARISON_INTENT:
      return "create";
    case RENAME_SAVED_COMPARISON_INTENT:
      return "rename";
    case DELETE_SAVED_COMPARISON_INTENT:
      return "delete";
    default:
      return null;
  }
}

export function compareSavedComparisonHref(savedComparisonId: string): string {
  const id = savedComparisonId.trim();
  if (!id) {
    return "/app/products/compare";
  }

  const params = new URLSearchParams({
    [SAVED_COMPARISON_PARAM]: id,
  });
  return `/app/products/compare?${params.toString()}`;
}

export function parseSavedComparisonId(
  searchParams: URLSearchParams,
): string | null {
  const id = searchParams.get(SAVED_COMPARISON_PARAM)?.trim() ?? "";
  return id || null;
}

export function parseSavedComparisonName(
  raw: unknown,
): { ok: true; name: string } | { ok: false; error: string } {
  if (typeof raw !== "string") {
    return { ok: false, error: "Enter a name for this comparison." };
  }

  const name = raw.trim();
  if (!name) {
    return { ok: false, error: "Enter a name for this comparison." };
  }

  if (name.length > SAVED_COMPARISON_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `Name must be ${SAVED_COMPARISON_NAME_MAX_LENGTH} characters or fewer.`,
    };
  }

  return { ok: true, name };
}

export function parseSavedComparisonItems(
  raw: unknown,
): { ok: true; items: SavedComparisonItemInput[] } | { ok: false; error: string } {
  const parsed = decodeSavedComparisonItems(raw);
  if (!parsed.ok) {
    return parsed;
  }

  return normalizeSavedComparisonItems(parsed.items);
}

function decodeSavedComparisonItems(
  raw: unknown,
): { ok: true; items: unknown[] } | { ok: false; error: string } {
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return { ok: false, error: "Select at least one product to save this comparison." };
      }
      return { ok: true, items: parsed };
    } catch {
      return { ok: false, error: "Select at least one product to save this comparison." };
    }
  }

  if (Array.isArray(raw)) {
    return { ok: true, items: raw };
  }

  return { ok: false, error: "Select at least one product to save this comparison." };
}

/**
 * Drops blank rows, rejects duplicate tracked products, and requires a variant.
 */
export function normalizeSavedComparisonItems(
  rawItems: readonly unknown[],
): { ok: true; items: SavedComparisonItemInput[] } | { ok: false; error: string } {
  const items: SavedComparisonItemInput[] = [];
  const seen = new Set<string>();

  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== "object") {
      return { ok: false, error: "Select at least one product to save this comparison." };
    }

    const trackedProductIdRaw = (rawItem as { trackedProductId?: unknown })
      .trackedProductId;
    const shopifyVariantIdRaw = (rawItem as { shopifyVariantId?: unknown })
      .shopifyVariantId;

    if (
      typeof trackedProductIdRaw !== "string" ||
      typeof shopifyVariantIdRaw !== "string"
    ) {
      return { ok: false, error: "Select at least one product to save this comparison." };
    }

    const trackedProductId = trackedProductIdRaw.trim();
    const shopifyVariantId = shopifyVariantIdRaw.trim();

    if (!trackedProductId) {
      continue;
    }

    if (!shopifyVariantId) {
      return {
        ok: false,
        error: "Each product needs a selected variant.",
      };
    }

    if (seen.has(trackedProductId)) {
      return {
        ok: false,
        error: "Each product can only appear once in a saved comparison.",
      };
    }

    seen.add(trackedProductId);
    items.push({ trackedProductId, shopifyVariantId });
  }

  if (items.length === 0) {
    return { ok: false, error: "Select at least one product to save this comparison." };
  }

  return { ok: true, items };
}

/**
 * Persist shape for Save comparison — workspace membership only.
 * Never includes Decision Strategies, prices, costs, or simulation results.
 */
export function buildSavedComparisonPersistPayload(
  name: string,
  items: readonly SavedComparisonItemInput[],
): SavedComparisonPersistPayload {
  return {
    name,
    items: items.map((item, position) => ({
      trackedProductId: item.trackedProductId,
      shopifyVariantId: item.shopifyVariantId,
      position,
    })),
  };
}

export function buildSavedComparisonItemsFromSnapshots(
  rows: readonly {
    trackedProductId: string;
    shopifyVariantId: string | null | undefined;
  }[],
): SavedComparisonItemInput[] {
  const items: SavedComparisonItemInput[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const trackedProductId = row.trackedProductId.trim();
    const shopifyVariantId = row.shopifyVariantId?.trim() ?? "";
    if (!trackedProductId || !shopifyVariantId || seen.has(trackedProductId)) {
      continue;
    }
    seen.add(trackedProductId);
    items.push({ trackedProductId, shopifyVariantId });
  }

  return items;
}

export function parseSavedComparisonFormData(formData: FormData):
  | { ok: true; name: string; items: SavedComparisonItemInput[] }
  | { ok: false; error: string } {
  const nameResult = parseSavedComparisonName(formData.get("name"));
  if (!nameResult.ok) {
    return nameResult;
  }

  const itemsResult = parseSavedComparisonItems(formData.get("items"));
  if (!itemsResult.ok) {
    return itemsResult;
  }

  return { ok: true, name: nameResult.name, items: itemsResult.items };
}

/**
 * Server-side ownership + variant checks for a submitted Save payload.
 * Uses already shop-scoped tracked IDs and live comparison products.
 */
export function assertSavedComparisonItemsOwned(input: {
  shopOwnedTrackedProductIds: ReadonlySet<string>;
  products: readonly ComparisonProduct[];
  items: readonly SavedComparisonItemInput[];
}): { ok: true } | { ok: false; error: string } {
  const productsById = new Map(
    input.products.map((product) => [product.trackedProductId, product]),
  );

  for (const item of input.items) {
    if (!input.shopOwnedTrackedProductIds.has(item.trackedProductId)) {
      return {
        ok: false,
        error: "One or more products are not tracked in this store.",
      };
    }

    const product = productsById.get(item.trackedProductId);
    if (!product) {
      return {
        ok: false,
        error: "One or more products are not tracked in this store.",
      };
    }

    const variantBelongs = product.variants.some(
      (variant) => variant.id === item.shopifyVariantId,
    );
    if (!variantBelongs) {
      return {
        ok: false,
        error: "A selected variant does not belong to its product.",
      };
    }
  }

  return { ok: true };
}

/**
 * Restore saved membership onto live comparison products.
 * Skips missing products and deleted variants — never substitutes a sibling variant.
 */
export function restoreComparisonProductsFromSavedItems(
  products: readonly ComparisonProduct[],
  items: readonly SavedComparisonItemInput[],
): { products: ComparisonProduct[]; skippedCount: number } {
  const productsById = new Map(
    products.map((product) => [product.trackedProductId, product]),
  );
  const restored: ComparisonProduct[] = [];
  let skippedCount = 0;

  for (const item of items) {
    const product = productsById.get(item.trackedProductId);
    const variantId = item.shopifyVariantId.trim();
    const variantExists =
      product?.variants.some((variant) => variant.id === variantId) ?? false;

    if (!product || !variantId || !variantExists) {
      skippedCount += 1;
      continue;
    }

    restored.push({
      ...product,
      defaultVariantId: variantId,
    });
  }

  return { products: restored, skippedCount };
}

export function formatSavedComparisonProductCount(productCount: number): string {
  return productCount === 1 ? "1 product" : `${productCount} products`;
}

export function formatRestoredComparisonSkipMessage(
  skippedCount: number,
): string {
  const itemLabel = skippedCount === 1 ? "product or variant" : "products or variants";
  return `Some ${itemLabel} in this saved comparison are no longer available. Remaining products were loaded with current prices and costs.`;
}

export function buildSaveComparisonFormPayload(
  name: string,
  items: readonly SavedComparisonItemInput[],
): Record<string, string> {
  return {
    intent: SAVE_COMPARISON_INTENT,
    name,
    items: JSON.stringify(items),
  };
}

export function hasSavedComparisonSnapshotFields(
  payload: SavedComparisonPersistPayload,
): boolean {
  const payloadRecord = payload as SavedComparisonPersistPayload &
    Record<string, unknown>;
  const forbiddenKeys = [
    "discount",
    "freeShipping",
    "free_shipping",
    "bundleOffer",
    "bundle_offer",
    "coupon",
    "cashback",
    "strategies",
    "decisionStrategies",
    "currentPrice",
    "sellingPrice",
    "cost",
    "totalCost",
    "effectiveCost",
    "profit",
    "margin",
    "simulatedPrice",
    "shopifyPrice",
  ];

  if (forbiddenKeys.some((key) => key in payloadRecord)) {
    return true;
  }

  return payload.items.some((item) => {
    const itemRecord = item as (typeof payload.items)[number] &
      Record<string, unknown>;
    return forbiddenKeys.some((key) => key in itemRecord);
  });
}
