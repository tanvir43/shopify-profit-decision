import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { PageLayout } from "~/components/PageLayout";
import { resolveShopCurrency } from "~/lib/shopCurrency.server";
import { getCachedShopCurrency } from "~/lib/shopSetupContext.server";
import { costProfileService } from "~/modules/cost-profiles/services/costProfileService.server";
import { categoryToCostItemType } from "~/modules/cost-profiles/types/CostItemType";
import {
  emptyAmounts,
  ProductDecisionDashboardPage,
  ProductOnboardingPage,
} from "~/modules/products";
import { hasProductCost } from "~/modules/products/lib/productStatus";
import { handleProductDetailsAction } from "~/modules/products/services/productDetailsActions.server";
import { loadProductDetailsEnrichment } from "~/modules/products/services/productDetailsEnrichment.server";
import { trackedProductService } from "~/modules/products/services/trackedProductService.server";
import { authenticate } from "~/shopify.server";

/**
 * Tracked product details — onboarding or Decision Workspace (PP-0011 / PP-0015.2).
 *
 * URL: /app/products/:trackedProductId
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  const trackedProductId = params.trackedProductId?.trim();
  if (!trackedProductId) {
    throw new Response("Tracked product ID is required.", { status: 400 });
  }

  const tracked = await trackedProductService.getTrackedProduct(
    session.shop,
    trackedProductId,
  );

  if (!tracked) {
    throw new Response("Tracked product not found.", { status: 404 });
  }

  const profile = await costProfileService.getByProduct(
    session.shop,
    tracked.shopifyProductId,
  );

  if (
    (profile?.mode === "QUICK_START" || profile?.mode === "DETAILED") &&
    hasProductCost(profile.totalCost)
  ) {
    const costAmounts = emptyAmounts();
    for (const item of profile.items) {
      const type = categoryToCostItemType(item.category);
      if (costAmounts[type] === "") {
        costAmounts[type] = item.value;
      }
    }

    return {
      view: "dashboard" as const,
      trackedProductId: tracked.id,
      mode: profile.mode,
      productTitle: tracked.shopifyProductId,
      productStatus: "UNKNOWN",
      imageUrl: null,
      imageAlt: null,
      currency: profile.currency,
      totalCost: profile.totalCost,
      sellingPrice: profile.sellingPrice,
      costAmounts,
      enrichment: loadProductDetailsEnrichment(
        admin,
        tracked.shopifyProductId,
      ),
    };
  }

  const currency =
    profile?.currency ??
    getCachedShopCurrency(session.shop) ??
    (await resolveShopCurrency(admin, session.shop));

  return {
    view: "onboarding" as const,
    trackedProductId: tracked.id,
    currency,
    totalCost: profile?.totalCost ?? null,
  };
};

export const action = (args: ActionFunctionArgs) =>
  handleProductDetailsAction(args);

export default function ProductDetailsRoute() {
  const data = useLoaderData<typeof loader>();

  if (data.view === "dashboard") {
    return <ProductDecisionDashboardPage data={data} />;
  }

  return <ProductOnboardingPage data={data} />;
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <PageLayout title="Product">
        <s-banner tone="critical" heading={`Error ${error.status}`}>
          <p>
            {error.data || error.statusText || "Request could not be completed."}
          </p>
        </s-banner>
      </PageLayout>
    );
  }

  return boundary.error(error);
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
