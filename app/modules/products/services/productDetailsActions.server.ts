import type { ActionFunctionArgs } from "react-router";

import { getCachedShopCurrency } from "~/lib/shopSetupContext.server";
import { CostProfileValidationError } from "~/modules/cost-profiles";
import { detailedSetupService } from "~/modules/cost-profiles/services/detailedSetupService.server";
import { quickStartService } from "~/modules/cost-profiles/services/quickStartService.server";
import {
  COST_ITEM_TYPES,
} from "~/modules/cost-profiles/types/CostItemType";
import type { DetailedSetupActionData } from "~/modules/products/DetailedSetupPage";
import type { QuickStartActionData } from "~/modules/products/QuickStartPage";
import { trackedProductService } from "~/modules/products/services/trackedProductService.server";
import { authenticate } from "~/shopify.server";

import { emptyAmounts } from "../components/CostBreakdownForm";

export type ProductDetailsActionData =
  | QuickStartActionData
  | DetailedSetupActionData;

/**
 * Cost-entry saves for the product details route — keeps fetcher POSTs on-page
 * so save + revalidation avoid a second route's auth/loader stack.
 */
export async function handleProductDetailsAction({
  request,
  params,
}: ActionFunctionArgs): Promise<ProductDetailsActionData> {
  const { session } = await authenticate.admin(request);

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

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "quick-start-save") {
    return handleQuickStartSave(formData, session.shop, tracked.shopifyProductId);
  }

  if (intent === "detailed-setup-save") {
    return handleDetailedSetupSave(
      formData,
      session.shop,
      tracked.shopifyProductId,
    );
  }

  return { ok: false, error: "We couldn't save your cost. Try again." };
}

async function handleQuickStartSave(
  formData: FormData,
  shop: string,
  shopifyProductId: string,
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

async function handleDetailedSetupSave(
  formData: FormData,
  shop: string,
  shopifyProductId: string,
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
