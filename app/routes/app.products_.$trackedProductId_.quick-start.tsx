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
import {
  CostProfileNotFoundError,
  CostProfileValidationError,
} from "~/modules/cost-profiles";
import { quickStartService } from "~/modules/cost-profiles/services/quickStartService.server";
import {
  QuickStartPage,
  type QuickStartActionData,
} from "~/modules/products";
import { fetchProductsByIds } from "~/modules/products/services/shopifyProductsService.server";
import { trackedProductService } from "~/modules/products/services/trackedProductService.server";
import { authenticate } from "~/shopify.server";

/**
 * Quick Start cost entry (PP-0012).
 *
 * URL: /app/products/:trackedProductId/quick-start
 * Trailing `_` on `$trackedProductId_` opts out of nesting under the product
 * details layout (same ADR-005 pattern as products_ / cost-profile).
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

  const currency = await resolveShopCurrency(admin);

  try {
    const profile = await quickStartService.openQuickStart({
      shop: session.shop,
      productId: tracked.shopifyProductId,
      currency,
    });

    const products = await fetchProductsByIds(admin, [tracked.shopifyProductId]);
    const enrichment = products.get(tracked.shopifyProductId);
    const productTitle =
      enrichment?.title ?? tracked.shopifyProductId;

    return {
      trackedProductId: tracked.id,
      productTitle,
      currency: profile.currency,
      totalCost: profile.totalCost,
    };
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    if (error instanceof CostProfileValidationError) {
      throw new Response(error.message, { status: 400 });
    }
    throw error;
  }
};

export const action = async ({
  request,
  params,
}: ActionFunctionArgs): Promise<QuickStartActionData> => {
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
  const totalCostRaw = formData.get("totalCost");

  if (typeof totalCostRaw !== "string") {
    return { ok: false, error: "Enter a total product cost." };
  }

  try {
    await quickStartService.saveQuickStartCost(
      session.shop,
      tracked.shopifyProductId,
      totalCostRaw,
    );

    return { ok: true };
  } catch (error) {
    if (error instanceof CostProfileValidationError) {
      return { ok: false, error: error.message };
    }
    if (error instanceof CostProfileNotFoundError) {
      return { ok: false, error: "We couldn't save your cost. Try again." };
    }
    return { ok: false, error: "We couldn't save your cost. Try again." };
  }
};

export default function QuickStartRoute() {
  const data = useLoaderData<typeof loader>();
  return <QuickStartPage data={data} />;
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <PageLayout title="Quick Start">
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
