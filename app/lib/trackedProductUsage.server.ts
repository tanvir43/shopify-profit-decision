import type { PrismaClient } from "@prisma/client";

import {
  entitlementForTier,
  resolvePlanEntitlementFromSubscription,
  type PlanEntitlement,
} from "~/lib/planEntitlements.server";
import {
  remainingTrackedProductCapacity,
  type TrackedProductCapacitySnapshot,
} from "~/lib/trackedProductCapacity";
import {
  checkActiveSubscription,
  type PartnerActiveSubscription,
} from "~/lib/partnerApi.server";

export type TrackedProductUsage = {
  entitlement: PlanEntitlement;
  hasActiveSubscription: boolean;
  currentCount: number;
  limit: number | null;
  remaining: number | null;
  isUnlimited: boolean;
};

export async function countTrackedProductsForShop(
  prisma: PrismaClient,
  shopId: string,
): Promise<number> {
  return prisma.trackedProduct.count({
    where: { shopId },
  });
}

export async function loadShopPlanEntitlement(shopGid: string): Promise<{
  entitlement: PlanEntitlement;
  subscription: PartnerActiveSubscription | null;
}> {
  const { subscription } = await checkActiveSubscription(shopGid);
  return {
    subscription,
    entitlement: resolvePlanEntitlementFromSubscription(subscription),
  };
}

export async function loadTrackedProductUsage(
  prisma: PrismaClient,
  shopDomain: string,
  shopGid: string,
): Promise<TrackedProductUsage> {
  const [{ entitlement, subscription }, currentCount] = await Promise.all([
    loadShopPlanEntitlement(shopGid),
    countTrackedProductsForShop(prisma, shopDomain),
  ]);

  const snapshot: TrackedProductCapacitySnapshot = {
    currentCount,
    limit: entitlement.trackedProductLimit,
  };

  return {
    entitlement,
    hasActiveSubscription: subscription !== null,
    currentCount,
    limit: entitlement.trackedProductLimit,
    remaining: remainingTrackedProductCapacity(snapshot),
    isUnlimited: entitlement.trackedProductLimit === null,
  };
}

/** Re-export for tests that pin a tier without Partner API. */
export { entitlementForTier };
