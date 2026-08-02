import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import {
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { PageLayout } from "~/components/PageLayout";
import { costProfileService } from "~/modules/cost-profiles/services/costProfileService.server";
import {
  ProductDecisionDashboardPage,
  ProductOnboardingPage,
} from "~/modules/products";
import { fetchProductsByIds } from "~/modules/products/services/shopifyProductsService.server";
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

  if (profile?.mode === "QUICK_START" || profile?.mode === "DETAILED") {
    let productTitle = tracked.shopifyProductId;
    let productStatus = "UNKNOWN";
    let imageUrl: string | null = null;
    let imageAlt: string | null = null;

    try {
      const products = await fetchProductsByIds(admin, [
        tracked.shopifyProductId,
      ]);
      const enrichment = products.get(tracked.shopifyProductId);

      if (enrichment) {
        productTitle = enrichment.title;
        productStatus = enrichment.status;
        imageUrl = enrichment.imageUrl;
        imageAlt = enrichment.imageAlt;
      } else {
        productTitle = "Product unavailable";
        productStatus = "UNAVAILABLE";
      }
    } catch {
      // Keep fallback identity when Shopify enrichment fails.
    }

    return {
      view: "dashboard" as const,
      trackedProductId: tracked.id,
      mode: profile.mode,
      productTitle,
      productStatus,
      imageUrl,
      imageAlt,
      currency: profile.currency,
      totalCost: profile.totalCost,
      sellingPrice: profile.sellingPrice,
    };
  }

  return {
    view: "onboarding" as const,
    trackedProductId: tracked.id,
  };
};

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
