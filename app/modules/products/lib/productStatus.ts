export type ProductStatusLabel =
  | "Active"
  | "Draft"
  | "Archived"
  | "Unavailable"
  | "Unknown";

export type ProductStatusTone = "success" | "caution" | "neutral";

export function formatProductStatus(
  status: string,
): { label: ProductStatusLabel; tone: ProductStatusTone } {
  switch (status) {
    case "ACTIVE":
      return { label: "Active", tone: "success" };
    case "DRAFT":
      return { label: "Draft", tone: "caution" };
    case "ARCHIVED":
      return { label: "Archived", tone: "neutral" };
    case "UNAVAILABLE":
      return { label: "Unavailable", tone: "neutral" };
    case "UNKNOWN":
      return { label: "Unknown", tone: "neutral" };
    default:
      return { label: "Draft", tone: "neutral" };
  }
}

export function isTrackedProductUnavailable(status: string): boolean {
  return status === "UNAVAILABLE";
}

export function costProfileHref(productId: string): string {
  return `/app/products/${encodeURIComponent(productId)}/cost-profile`;
}

export function trackedProductHref(trackedProductId: string): string {
  return `/app/products/${encodeURIComponent(trackedProductId)}`;
}

/**
 * Tracked Products list, optionally marking a row to highlight after back navigation.
 */
export function trackedProductsListHref(highlightTrackedProductId?: string): string {
  if (!highlightTrackedProductId) {
    return "/app/products";
  }

  const params = new URLSearchParams({
    highlight: highlightTrackedProductId,
  });
  return `/app/products?${params.toString()}`;
}

/** True when a cost profile has a saved product cost (Decision Workspace ready). */
export function hasProductCost(totalCost: string | null | undefined): boolean {
  return totalCost != null;
}

export function quickStartHref(trackedProductId: string): string {
  return `/app/products/${encodeURIComponent(trackedProductId)}/quick-start`;
}

export function detailedSetupHref(trackedProductId: string): string {
  return `/app/products/${encodeURIComponent(trackedProductId)}/detailed-setup`;
}

export function sellingPriceHref(trackedProductId: string): string {
  return `/app/products/${encodeURIComponent(trackedProductId)}/selling-price`;
}

const COMPARE_SCENARIOS_IDS_PARAM = "ids";

/**
 * Comparison shell. Selected tracked-product IDs travel in the query string
 * so they survive navigation without persisted UI state.
 */
export function compareScenariosHref(trackedProductIds: string[]): string {
  const uniqueIds: string[] = [];
  const seen = new Set<string>();

  for (const trackedProductId of trackedProductIds) {
    const id = trackedProductId.trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    uniqueIds.push(id);
  }

  if (uniqueIds.length === 0) {
    return "/app/products/compare";
  }

  const params = new URLSearchParams({
    [COMPARE_SCENARIOS_IDS_PARAM]: uniqueIds.join(","),
  });
  return `/app/products/compare?${params.toString()}`;
}

export function parseCompareScenarioIds(searchParams: URLSearchParams): string[] {
  const raw = searchParams.get(COMPARE_SCENARIOS_IDS_PARAM) ?? "";
  if (!raw.trim()) {
    return [];
  }

  const ids: string[] = [];
  const seen = new Set<string>();

  for (const part of raw.split(",")) {
    const id = part.trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
  }

  return ids;
}
