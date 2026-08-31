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
import {
  CostProfileNotFoundError,
  CostProfileValidationError,
} from "~/modules/cost-profiles";
import { sellingPriceService } from "~/modules/cost-profiles/services/sellingPriceService.server";
import {
  SellingPricePage,
  type SellingPriceActionData,
} from "~/modules/products";
import { fetchProductsByIds } from "~/modules/products/services/shopifyProductsService.server";
import { trackedProductService } from "~/modules/products/services/trackedProductService.server";
import { resolveTrackedProductVariantId } from "~/modules/products/services/variantSelection.server";
import { authenticate } from "~/shopify.server";

/**
 * Selling price entry.
 *
 * URL: /app/products/:trackedProductId/selling-price
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

  const shopifyVariantId = await resolveTrackedProductVariantId(admin, tracked);

  const profile = await sellingPriceService.getSellingPriceProfile(
    session.shop,
    tracked.shopifyProductId,
    shopifyVariantId,
  );

  if (!profile) {
    throw new Response("Set up product cost before entering a selling price.", {
      status: 400,
    });
  }

  const products = await fetchProductsByIds(admin, [tracked.shopifyProductId]);
  const enrichment = products.get(tracked.shopifyProductId);
  const productTitle = enrichment?.title ?? tracked.shopifyProductId;

  return {
    trackedProductId: tracked.id,
    productTitle,
    currency: profile.currency,
    totalCost: profile.totalCost,
    sellingPrice: profile.sellingPrice,
  };
};

export const action = async ({
  request,
  params,
}: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  const trackedProductId = params.trackedProductId?.trim();
  if (!trackedProductId) {
    return { ok: false, error: "We couldn't save your selling price. Try again." } satisfies SellingPriceActionData;
  }

  const tracked = await trackedProductService.getTrackedProduct(
    session.shop,
    trackedProductId,
  );

  if (!tracked) {
    return { ok: false, error: "We couldn't save your selling price. Try again." } satisfies SellingPriceActionData;
  }

  const formData = await request.formData();
  const sellingPriceRaw = formData.get("sellingPrice");
  if (typeof sellingPriceRaw !== "string") {
    return { ok: false, error: "Enter a selling price." } satisfies SellingPriceActionData;
  }

  const shopifyVariantId = await resolveTrackedProductVariantId(admin, tracked);

  try {
    await sellingPriceService.saveSellingPrice(
      session.shop,
      tracked.shopifyProductId,
      sellingPriceRaw,
      shopifyVariantId,
    );
  } catch (error) {
    if (error instanceof CostProfileValidationError) {
      return { ok: false, error: error.message } satisfies SellingPriceActionData;
    }
    if (error instanceof CostProfileNotFoundError) {
      return {
        ok: false,
        error: "We couldn't save your selling price. Try again.",
      } satisfies SellingPriceActionData;
    }

    console.error("Failed to save selling price", error);
    return {
      ok: false,
      error: "We couldn't save your selling price. Try again.",
    } satisfies SellingPriceActionData;
  }

  // JSON success lets the Decision Workspace inline editor stay put and
  // revalidate; the dedicated Selling Price page navigates on ok.
  return { ok: true } satisfies SellingPriceActionData;
};

export default function SellingPriceRoute() {
  const data = useLoaderData<typeof loader>();
  return <SellingPricePage data={data} />;
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <PageLayout title="Selling Price">
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
