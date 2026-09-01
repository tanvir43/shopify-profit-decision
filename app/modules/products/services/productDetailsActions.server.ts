import type { ActionFunctionArgs } from "react-router";

import { getCachedShopCurrency } from "~/lib/shopSetupContext.server";
import { resolveShopCurrency } from "~/lib/shopCurrency.server";
import { CostProfileValidationError } from "~/modules/cost-profiles";
import { detailedSetupService } from "~/modules/cost-profiles/services/detailedSetupService.server";
import { quickStartService } from "~/modules/cost-profiles/services/quickStartService.server";
import {
  COST_ITEM_TYPES,
} from "~/modules/cost-profiles/types/CostItemType";
import type { DetailedSetupActionData } from "~/modules/products/DetailedSetupPage";
import type { QuickStartActionData } from "~/modules/products/QuickStartPage";
import { costProfileService } from "~/modules/cost-profiles/services/costProfileService.server";
import { resolveTrackedProductVariantId } from "~/modules/products/services/variantSelection.server";
import { trackedProductService } from "~/modules/products/services/trackedProductService.server";
import { authenticate } from "~/shopify.server";

import { emptyAmounts } from "../components/CostBreakdownForm";
import { loadOnboardingPreCostOptions } from "./productOnboardingPreCost.server";
import { fetchProductsByIds } from "./shopifyProductsService.server";

export type ProductDetailsActionData =
  | QuickStartActionData
  | DetailedSetupActionData;

async function resolveVariantIdForTrackedProduct(
  admin: Awaited<ReturnType<typeof authenticate.admin>>["admin"],
  tracked: NonNullable<Awaited<ReturnType<typeof trackedProductService.getTrackedProduct>>>,
): Promise<string> {
  return resolveTrackedProductVariantId(admin, tracked);
}

/**
 * Cost-entry saves for the product details route — keeps fetcher POSTs on-page
 * so save + revalidation avoid a second route's auth/loader stack.
 *
 * `formData` must be the already-parsed request body from the route action
 * (request bodies can only be read once).
 */
export async function handleProductDetailsAction(
  { request, params }: ActionFunctionArgs,
  formData: FormData,
): Promise<ProductDetailsActionData> {
  const { session, admin } = await authenticate.admin(request);

  const trackedProductId = params.trackedProductId?.trim();
  if (!trackedProductId) {
    return { ok: false, error: "We couldn't save your cost. Try again." };
  }

  const tracked = await trackedProductService.getTrackedProduct(
    session.shop,
    trackedProductId,
  );

  if (!tracked) {
    return { ok: false, error: "We couldn't save your cost. Try again." };
  }

  const shopifyVariantId = await resolveVariantIdForTrackedProduct(admin, tracked);

  const intent = formData.get("intent");

  if (intent === "quick-start-save") {
    return handleQuickStartSave(
      formData,
      session.shop,
      tracked.shopifyProductId,
      shopifyVariantId,
    );
  }

  if (intent === "detailed-setup-save") {
    return handleDetailedSetupSave(
      formData,
      session.shop,
      tracked.shopifyProductId,
      shopifyVariantId,
    );
  }

  if (intent === "use-pre-cost" || intent === "use-shopify-pre-cost") {
    return handleUsePreCost(admin, tracked, session.shop, shopifyVariantId, formData);
  }

  return { ok: false, error: "We couldn't save your cost. Try again." };
}

async function handleQuickStartSave(
  formData: FormData,
  shop: string,
  shopifyProductId: string,
  shopifyVariantId: string,
): Promise<QuickStartActionData> {
  const totalCostRaw = formData.get("totalCost");
  const currencyRaw = formData.get("currency");

  if (typeof totalCostRaw !== "string") {
    return { ok: false, error: "Enter a total product cost." };
  }

  const currency =
    (typeof currencyRaw === "string" && currencyRaw.trim()) ||
    getCachedShopCurrency(shop);

  if (!currency) {
    return { ok: false, error: "We couldn't save your cost. Try again." };
  }

  try {
    await quickStartService.saveQuickStartCost({
      shop,
      productId: shopifyProductId,
      shopifyVariantId,
      totalCostRaw,
      currency,
    });

    return { ok: true };
  } catch (error) {
    if (error instanceof CostProfileValidationError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "We couldn't save your cost. Try again." };
  }
}

async function handleUsePreCost(
  admin: Awaited<ReturnType<typeof authenticate.admin>>["admin"],
  tracked: NonNullable<Awaited<ReturnType<typeof trackedProductService.getTrackedProduct>>>,
  shop: string,
  shopifyVariantId: string,
  formData: FormData,
): Promise<QuickStartActionData> {
  const preCostIdRaw = formData.get("preCostId");
  const preCostId =
    typeof preCostIdRaw === "string" && preCostIdRaw.trim().length > 0
      ? preCostIdRaw.trim()
      : "shopify";

  const [profiles, enrichmentMap] = await Promise.all([
    costProfileService.findAllForProduct(shop, tracked.shopifyProductId),
    fetchProductsByIds(admin, [tracked.shopifyProductId]),
  ]);
  const variants = enrichmentMap.get(tracked.shopifyProductId)?.variants ?? [];
  const options = await loadOnboardingPreCostOptions(
    admin,
    tracked,
    profiles,
    variants,
  );

  const selected =
    options.find((option) => option.id === preCostId) ??
    (preCostId === "shopify" ? options[0] : undefined);

  if (!selected) {
    return {
      ok: false,
      error:
        "That product cost is no longer available. Refresh and try again.",
    };
  }

  const currency =
    getCachedShopCurrency(shop) || (await resolveShopCurrency(admin, shop));
  if (!currency) {
    return { ok: false, error: "We couldn't save your cost. Try again." };
  }

  try {
    await quickStartService.saveQuickStartCost({
      shop,
      productId: tracked.shopifyProductId,
      shopifyVariantId,
      totalCostRaw: selected.totalCost,
      currency,
    });

    return { ok: true };
  } catch (error) {
    if (error instanceof CostProfileValidationError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "We couldn't save your cost. Try again." };
  }
}

async function handleDetailedSetupSave(
  formData: FormData,
  shop: string,
  shopifyProductId: string,
  shopifyVariantId: string,
): Promise<DetailedSetupActionData> {
  const amounts = emptyAmounts();

  for (const type of COST_ITEM_TYPES) {
    const raw = formData.get(type);
    amounts[type] = typeof raw === "string" ? raw : "";
  }

  const currencyRaw = formData.get("currency");
  const currency =
    (typeof currencyRaw === "string" && currencyRaw.trim()) ||
    getCachedShopCurrency(shop);

  if (!currency) {
    return { ok: false, error: "We couldn't save your costs. Try again." };
  }

  try {
    await detailedSetupService.saveDetailedBreakdown({
      shop,
      productId: shopifyProductId,
      shopifyVariantId,
      currency,
      amounts,
    });

    return { ok: true };
  } catch (error) {
    if (error instanceof CostProfileValidationError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "We couldn't save your costs. Try again." };
  }
}
