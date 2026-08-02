import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import {
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { PageLayout } from "~/components/PageLayout";
import { resolveShopCurrency } from "~/lib/shopCurrency.server";
import {
  CostProfileNotFoundError,
  CostProfilePage,
  CostProfileValidationError,
  type CostProfile,
  type CostProfilePageData,
} from "~/modules/cost-profiles";
import { costProfileService } from "~/modules/cost-profiles/services/costProfileService.server";
import { authenticate } from "~/shopify.server";

function toPageData(profile: CostProfile): CostProfilePageData {
  const items = [...profile.items]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      unit: item.unit,
      isActive: item.isActive,
    }));

  return {
    productId: profile.productId,
    currency: profile.currency,
    status: items.length > 0 ? "configured" : "not_configured",
    totalCostItems: items.length,
    activeCostItems: items.filter((item) => item.isActive).length,
    items,
  };
}

/**
 * Product-scoped Cost Profile route.
 *
 * URL: /app/products/:productId/cost-profile
 * Uses trailing `_` on `products_` so this nests under `app` layout only —
 * not under the products list leaf (ADR-005).
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  const productId = params.productId?.trim();
  if (!productId) {
    throw new Response("Product ID is required.", { status: 400 });
  }

  const shop = session.shop;

  try {
    const existing = await costProfileService.getByProduct(shop, productId);
    if (existing) {
      return { profile: toPageData(existing) };
    }

    const currency = await resolveShopCurrency(admin);
    const profile = await costProfileService.ensureForProduct({
      shop,
      productId,
      currency,
    });

    return { profile: toPageData(profile) };
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    if (error instanceof CostProfileValidationError) {
      throw new Response(error.message, { status: 400 });
    }
    if (error instanceof CostProfileNotFoundError) {
      throw new Response(error.message, { status: 404 });
    }
    throw error;
  }
};

export default function CostProfileRoute() {
  const { profile } = useLoaderData<typeof loader>();
  return <CostProfilePage profile={profile} />;
}

/**
 * Expected business failures arrive as Response (isRouteErrorResponse).
 * Unexpected failures fall through to Shopify's boundary (auth / system).
 */
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <PageLayout title="Cost Profile">
        <s-banner tone="critical" heading={`Error ${error.status}`}>
          <p>{error.data || error.statusText || "Request could not be completed."}</p>
        </s-banner>
      </PageLayout>
    );
  }

  return boundary.error(error);
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
