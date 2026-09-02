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

async function readVariantShopifyCost(
  admin: AdminGraphql,
  variant: ShopifyProductVariantEnrichment,
): Promise<string | null> {
  const fromShopify = await fetchVariantUnitCost(admin, variant.id);
  return normalizeShopMoneyAmount(fromShopify);
}

/**
 * Pre-existing costs the merchant can adopt during onboarding.
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
  const shopifyVariantId = resolveShopifyVariantIdForUpdate(
    costProfileVariantId,
    variants,
    tracked.selectedShopifyVariantId,
  );

  const options: OnboardingPreCostOption[] = [];
  const seen = new Set<string>();

  if (shopifyVariantId) {
    const variant = variants.find((item) => item.id === shopifyVariantId);
    const totalCost = variant
      ? await readVariantShopifyCost(admin, variant)
      : normalizeShopMoneyAmount(await fetchVariantUnitCost(admin, shopifyVariantId));

    if (totalCost) {
      const label = variantLabel(shopifyVariantId, variants);
      addOption(options, seen, {
        id: `shopify-${shopifyVariantId}`,
        title: label ? `Use Shopify cost for ${label}` : "Use Shopify product cost",
        description: "Cost already saved in your Shopify admin.",
        totalCost,
      });
    }
  }

  for (const variant of variants) {
    if (variant.id === shopifyVariantId) {
      continue;
    }

    const totalCost = await readVariantShopifyCost(admin, variant);
    if (!totalCost) {
      continue;
    }

    addOption(options, seen, {
      id: `shopify-${variant.id}`,
      title: `Use Shopify cost for ${variant.title}`,
      description: "Cost already saved in your Shopify admin.",
      totalCost,
    });
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
