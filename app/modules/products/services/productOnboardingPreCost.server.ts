import type { CostProfile } from "~/modules/cost-profiles/types/CostProfile";
import type { authenticate } from "~/shopify.server";

import { normalizeShopMoneyAmount } from "../lib/normalizeShopMoneyAmount";
import { hasProductCost } from "../lib/productStatus";
import { resolveActiveCostProfileVariantId } from "../lib/resolveProductDetailView";
import {
  resolveShopifyVariantIdForUpdate,
  PRODUCT_LEVEL_VARIANT_ID,
} from "../lib/variantContext";
import type { TrackedProduct } from "../types/TrackedProduct";
import {
  fetchVariantUnitCost,
  type ShopifyProductVariantEnrichment,
} from "./shopifyProductsService.server";

type AdminGraphql = Awaited<ReturnType<typeof authenticate.admin>>["admin"];

export type OnboardingPreCostOption = {
  id: string;
  title: string;
  description: string;
  totalCost: string;
};

function variantLabel(
  shopifyVariantId: string,
  variants: ShopifyProductVariantEnrichment[],
): string | null {
  if (shopifyVariantId === PRODUCT_LEVEL_VARIANT_ID) {
    return null;
  }

  return variants.find((variant) => variant.id === shopifyVariantId)?.title ?? null;
}

function addOption(
  options: OnboardingPreCostOption[],
  seen: Set<string>,
  option: OnboardingPreCostOption,
) {
  const key = `${option.id}:${option.totalCost}`;
  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  options.push(option);
}

/**
 * Reads Shopify Cost per item for a variant — enrichment first, then live fallback.
 */
async function readVariantShopifyCost(
  admin: AdminGraphql,
  variant: ShopifyProductVariantEnrichment,
): Promise<string | null> {
  const fromEnrichment = normalizeShopMoneyAmount(variant.unitCost);
  if (fromEnrichment) {
    return fromEnrichment;
  }

  const fromShopify = await fetchVariantUnitCost(admin, variant.id);
  return normalizeShopMoneyAmount(fromShopify);
}

function shopifyCostOption(
  shopifyVariantId: string,
  totalCost: string,
  variants: ShopifyProductVariantEnrichment[],
): OnboardingPreCostOption {
  const label = variantLabel(shopifyVariantId, variants);
  const multiVariant = variants.length > 1;

  return {
    id: `shopify-${shopifyVariantId}`,
    title: label
      ? `Use Shopify cost for ${label}`
      : multiVariant
        ? "Use Shopify cost for this variant"
        : "Use Shopify product cost",
    description: "Cost already saved in your Shopify admin.",
    totalCost,
  };
}

/**
 * Pre-existing costs the merchant can adopt during onboarding.
 * Includes Shopify unit costs for the active variant (and other variants when present).
 */
export async function loadOnboardingPreCostOptions(
  admin: AdminGraphql,
  tracked: TrackedProduct,
  profiles: CostProfile[],
  variants: ShopifyProductVariantEnrichment[],
): Promise<OnboardingPreCostOption[]> {
  const costProfileVariantId = resolveActiveCostProfileVariantId({
    variants,
    profiles,
    selectedShopifyVariantId: tracked.selectedShopifyVariantId,
  });
  const activeShopifyVariantId = resolveShopifyVariantIdForUpdate(
    costProfileVariantId,
    variants,
    tracked.selectedShopifyVariantId,
  );

  const options: OnboardingPreCostOption[] = [];
  const seen = new Set<string>();

  // Prefer the variant currently being set up (selected / sole / resolved).
  const prioritizedIds: string[] = [];
  if (activeShopifyVariantId) {
    prioritizedIds.push(activeShopifyVariantId);
  }
  for (const variant of variants) {
    if (!prioritizedIds.includes(variant.id)) {
      prioritizedIds.push(variant.id);
    }
  }

  const costByVariantId = new Map<string, string | null>();

  await Promise.all(
    prioritizedIds.map(async (variantId) => {
      const variant = variants.find((item) => item.id === variantId);
      if (variant) {
        costByVariantId.set(variantId, await readVariantShopifyCost(admin, variant));
        return;
      }

      costByVariantId.set(
        variantId,
        normalizeShopMoneyAmount(await fetchVariantUnitCost(admin, variantId)),
      );
    }),
  );

  for (const variantId of prioritizedIds) {
    const totalCost = costByVariantId.get(variantId);
    if (!totalCost) {
      continue;
    }

    addOption(options, seen, shopifyCostOption(variantId, totalCost, variants));
  }

  for (const profile of profiles) {
    if (profile.shopifyVariantId === costProfileVariantId) {
      continue;
    }

    if (!hasProductCost(profile.totalCost)) {
      continue;
    }

    const label = variantLabel(profile.shopifyVariantId, variants);
    addOption(options, seen, {
      id: `profitpilot-${profile.shopifyVariantId}`,
      title: label
        ? `Use ProfitPilot cost for ${label}`
        : "Use saved ProfitPilot product cost",
      description: "Cost already saved in ProfitPilot for another variant.",
      totalCost: profile.totalCost!,
    });
  }

  return options;
}
