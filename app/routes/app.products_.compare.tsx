import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { CompareScenariosPage } from "~/modules/products";
import { APPLY_COMPARISON_PRICES_INTENT } from "~/modules/products/lib/compareApplyToShopify";
import { parseCompareScenarioIds } from "~/modules/products/lib/productStatus";
import { parseSavedComparisonId, SAVE_COMPARISON_INTENT } from "~/modules/products/lib/savedComparisons";
import { handleApplyComparisonPricesAction } from "~/modules/products/services/compareApplyToShopify.server";
import {
  loadCompareScenariosPageData,
  readCompareDetailedCostAmounts,
  saveCompareScenarioDetailedCost,
  saveCompareScenarioQuickStartCost,
  type CompareScenariosActionData,
} from "~/modules/products/services/compareScenarios.server";
import { handleSaveComparisonAction, loadCompareScenariosFromSavedComparison } from "~/modules/products/services/savedComparisons.server";
import { authenticate } from "~/shopify.server";

/**
 * Multi-product comparison foundation.
 * Selected tracked-product IDs come from the query string and are
 * resolved against the authenticated shop only.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const savedComparisonId = parseSavedComparisonId(url.searchParams);

  if (savedComparisonId) {
    return loadCompareScenariosFromSavedComparison(
      admin,
      session.shop,
      savedComparisonId,
    );
  }

  return loadCompareScenariosPageData(
    admin,
    session.shop,
    parseCompareScenarioIds(url.searchParams),
  );
};

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<
  | CompareScenariosActionData
  | Awaited<ReturnType<typeof handleApplyComparisonPricesAction>>
  | Awaited<ReturnType<typeof handleSaveComparisonAction>>
> => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === APPLY_COMPARISON_PRICES_INTENT) {
    return handleApplyComparisonPricesAction(admin, session.shop, formData);
  }

  if (intent === SAVE_COMPARISON_INTENT) {
    return handleSaveComparisonAction(admin, session.shop, formData);
  }

  const trackedProductIdRaw = formData.get("trackedProductId");
  const currencyRaw = formData.get("currency");
  const shopifyVariantIdRaw = formData.get("shopifyVariantId");
  const shopifyVariantId =
    typeof shopifyVariantIdRaw === "string" ? shopifyVariantIdRaw : "";

  if (intent === "detailed-setup-save") {
    if (
      typeof trackedProductIdRaw !== "string" ||
      typeof currencyRaw !== "string"
    ) {
      return { ok: false, error: "We couldn't save your costs. Try again." };
    }

    return saveCompareScenarioDetailedCost(admin, session.shop, {
      trackedProductId: trackedProductIdRaw,
      shopifyVariantId,
      currency: currencyRaw,
      amounts: readCompareDetailedCostAmounts(formData),
    });
  }

  if (intent !== "quick-start-save") {
    return { ok: false, error: "We couldn't save your cost. Try again." };
  }

  const totalCostRaw = formData.get("totalCost");

  if (
    typeof trackedProductIdRaw !== "string" ||
    typeof totalCostRaw !== "string" ||
    typeof currencyRaw !== "string"
  ) {
    return { ok: false, error: "We couldn't save your cost. Try again." };
  }

  return saveCompareScenarioQuickStartCost(admin, session.shop, {
    trackedProductId: trackedProductIdRaw,
    shopifyVariantId,
    totalCostRaw,
    currency: currencyRaw,
  });
};

export default function CompareScenariosRoute() {
  const data = useLoaderData<typeof loader>();
  return <CompareScenariosPage data={data} />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
