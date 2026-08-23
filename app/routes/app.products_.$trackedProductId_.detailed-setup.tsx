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
  fetchShopSetupContext,
  getCachedShopCurrency,
} from "~/lib/shopSetupContext.server";
import { CostProfileValidationError } from "~/modules/cost-profiles";
import { detailedSetupService } from "~/modules/cost-profiles/services/detailedSetupService.server";
import {
  COST_ITEM_TYPES,
  categoryToCostItemType,
} from "~/modules/cost-profiles/types/CostItemType";
import {
  DetailedSetupPage,
  emptyAmounts,
  type DetailedSetupActionData,
} from "~/modules/products";
import { trackedProductService } from "~/modules/products/services/trackedProductService.server";
import { authenticate } from "~/shopify.server";

/**
 * Detailed Cost Builder (PP-0013).
 *
 * URL: /app/products/:trackedProductId/detailed-setup
 * First-time onboarding prefers the Advanced Setup modal on the product
 * details page; this route remains for deep links and CostBreakdownModal saves.
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

  const [profile, setup] = await Promise.all([
    detailedSetupService.getDetailedSetupProfile(
      session.shop,
      tracked.shopifyProductId,
    ),
    fetchShopSetupContext(admin, session.shop, [tracked.shopifyProductId]),
  ]);

  const amounts = emptyAmounts();
  if (profile) {
    for (const item of profile.items) {
      const type = categoryToCostItemType(item.category);
      if (amounts[type] === "") {
        amounts[type] = item.value;
      }
    }
  }

  const enrichment = setup.products.get(tracked.shopifyProductId);
  const productTitle = enrichment?.title ?? tracked.shopifyProductId;

  return {
    trackedProductId: tracked.id,
    productTitle,
    currency: profile?.currency ?? setup.currency,
    amounts,
  };
};

export const action = async ({
  request,
  params,
}: ActionFunctionArgs): Promise<DetailedSetupActionData> => {
  const { session, admin } = await authenticate.admin(request);

  const trackedProductId = params.trackedProductId?.trim();
  if (!trackedProductId) {
    return { ok: false, error: "We couldn't save your costs. Try again." };
  }

  const tracked = await trackedProductService.getTrackedProduct(
    session.shop,
    trackedProductId,
  );

  if (!tracked) {
    return { ok: false, error: "We couldn't save your costs. Try again." };
  }

  const formData = await request.formData();
  const amounts = emptyAmounts();

  for (const type of COST_ITEM_TYPES) {
    const raw = formData.get(type);
    amounts[type] = typeof raw === "string" ? raw : "";
  }

  const currencyRaw = formData.get("currency");
  const currency =
    (typeof currencyRaw === "string" && currencyRaw.trim()) ||
    getCachedShopCurrency(session.shop) ||
    (await resolveShopCurrency(admin, session.shop));

  try {
    await detailedSetupService.saveDetailedBreakdown({
      shop: session.shop,
      productId: tracked.shopifyProductId,
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
};

export default function DetailedSetupRoute() {
  const data = useLoaderData<typeof loader>();
  return <DetailedSetupPage data={data} />;
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <PageLayout title="Detailed Setup">
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
