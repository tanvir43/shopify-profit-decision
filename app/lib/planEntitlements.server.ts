/**
 * Central plan → tracked-product entitlement mapping for Shopify App Pricing.
 * Plan handles come from Partner API subscription items.
 */

import type { PartnerActiveSubscription } from "~/lib/partnerApi.server";

export type PlanTierId = "starter" | "growth" | "pro" | "unlimited";

export type PlanEntitlement = {
  tierId: PlanTierId;
  displayName: string;
  /** null = unlimited tracked products */
  trackedProductLimit: number | null;
};

const PLAN_CATALOG: Record<
  PlanTierId,
  Pick<PlanEntitlement, "displayName" | "trackedProductLimit">
> = {
  starter: { displayName: "Starter", trackedProductLimit: 50 },
  growth: { displayName: "Growth", trackedProductLimit: 150 },
  pro: { displayName: "Pro", trackedProductLimit: 400 },
  unlimited: { displayName: "Unlimited", trackedProductLimit: null },
};

const TIER_ORDER: PlanTierId[] = ["starter", "growth", "pro", "unlimited"];

function readPlanHandleEnv(envKey: string): string[] {
  const raw = process.env[envKey]?.trim();
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0);
}

function buildHandleToTierMap(): Map<string, PlanTierId> {
  const map = new Map<string, PlanTierId>();

  const envEntries: Array<[PlanTierId, string]> = [
    ["starter", "SHOPIFY_PLAN_HANDLE_STARTER"],
    ["growth", "SHOPIFY_PLAN_HANDLE_GROWTH"],
    ["pro", "SHOPIFY_PLAN_HANDLE_PRO"],
    ["unlimited", "SHOPIFY_PLAN_HANDLE_UNLIMITED"],
  ];

  for (const [tierId, envKey] of envEntries) {
    for (const handle of readPlanHandleEnv(envKey)) {
      map.set(handle, tierId);
    }
  }

  // Shopify App Pricing canonical handles are authoritative. Environment
  // aliases remain optional for genuinely legacy handles.
  map.set("monthly", "starter");
  map.set("growth", "growth");
  map.set("pro", "pro");
  map.set("unlimited", "unlimited");

  return map;
}

const HANDLE_TO_TIER = buildHandleToTierMap();

/** Default tier for an active subscription whose handle is not yet mapped in env. */
export const LEGACY_DEFAULT_TIER_ID: PlanTierId = "starter";

export function entitlementForTier(tierId: PlanTierId): PlanEntitlement {
  const catalog = PLAN_CATALOG[tierId];
  return {
    tierId,
    displayName: catalog.displayName,
    trackedProductLimit: catalog.trackedProductLimit,
  };
}

/**
 * Resolve entitlement from Partner API subscription item handles.
 * Uses the highest known tier when multiple handles are present.
 * Unknown handles fall back to Starter for safe legacy compatibility.
 */
export function resolvePlanEntitlementFromSubscription(
  subscription: PartnerActiveSubscription | null,
): PlanEntitlement {
  if (!subscription) {
    return entitlementForTier(LEGACY_DEFAULT_TIER_ID);
  }

  const handles = subscription.items
    .map((item) => item.handle?.trim().toLowerCase())
    .filter((handle): handle is string => Boolean(handle));

  let resolvedTier: PlanTierId | null = null;

  for (const tierId of [...TIER_ORDER].reverse()) {
    if (handles.some((handle) => HANDLE_TO_TIER.get(handle) === tierId)) {
      resolvedTier = tierId;
      break;
    }
  }

  if (!resolvedTier) {
    resolvedTier = LEGACY_DEFAULT_TIER_ID;
  }

  return entitlementForTier(resolvedTier);
}

export function isUnlimitedPlan(entitlement: PlanEntitlement): boolean {
  return entitlement.trackedProductLimit === null;
}
