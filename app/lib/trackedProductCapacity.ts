/**
 * Pure helpers for tracked-product capacity checks (one TrackedProduct row per slot).
 */

export type TrackedProductCapacitySnapshot = {
  currentCount: number;
  limit: number | null;
};

export class TrackedProductLimitExceededError extends Error {
  readonly code = "TRACKED_PRODUCT_LIMIT_EXCEEDED" as const;

  constructor(message: string) {
    super(message);
    this.name = "TrackedProductLimitExceededError";
  }
}

export function countNewUniqueProductIds(
  requestedProductIds: string[],
  alreadyTrackedProductIds: ReadonlySet<string>,
): number {
  const seen = new Set<string>();
  let additional = 0;

  for (const raw of requestedProductIds) {
    const productId = raw.trim();
    if (
      productId.length === 0 ||
      alreadyTrackedProductIds.has(productId) ||
      seen.has(productId)
    ) {
      continue;
    }
    seen.add(productId);
    additional += 1;
  }

  return additional;
}

export function canAddTrackedProducts(
  snapshot: TrackedProductCapacitySnapshot,
  additionalSlots: number,
): boolean {
  if (additionalSlots <= 0 || snapshot.limit === null) {
    return true;
  }

  return snapshot.currentCount + additionalSlots <= snapshot.limit;
}

export function remainingTrackedProductCapacity(
  snapshot: TrackedProductCapacitySnapshot,
): number | null {
  if (snapshot.limit === null) {
    return null;
  }

  return Math.max(0, snapshot.limit - snapshot.currentCount);
}

export function formatTrackedProductLimitMessage(input: {
  planDisplayName: string;
  limit: number;
  currentCount: number;
  additionalRequested: number;
}): string {
  const remaining = Math.max(0, input.limit - input.currentCount);

  if (input.additionalRequested <= remaining) {
    return "";
  }

  return `Your ${input.planDisplayName} plan allows up to ${input.limit} tracked products. You currently have ${input.currentCount} tracked products and can add ${remaining} more.`;
}

export function buildTrackedProductLimitError(
  entitlement: {
    displayName: string;
    trackedProductLimit: number | null;
  },
  currentCount: number,
  additionalRequested: number,
): TrackedProductLimitExceededError {
  if (entitlement.trackedProductLimit === null) {
    return new TrackedProductLimitExceededError(
      "Unable to add tracked products for this plan.",
    );
  }

  const message = formatTrackedProductLimitMessage({
    planDisplayName: entitlement.displayName,
    limit: entitlement.trackedProductLimit,
    currentCount,
    additionalRequested,
  });

  return new TrackedProductLimitExceededError(
    message || "Your plan does not allow adding more tracked products.",
  );
}
