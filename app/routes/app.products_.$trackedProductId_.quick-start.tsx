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
import {
  CostProfileValidationError,
} from "~/modules/cost-profiles";
import { quickStartService } from "~/modules/cost-profiles/services/quickStartService.server";
import {
  QuickStartPage,
  type QuickStartActionData,
} from "~/modules/products";
import { trackedProductService } from "~/modules/products/services/trackedProductService.server";
import { authenticate } from "~/shopify.server";

/**
 * Quick Start cost entry (PP-0012).
 *
 * URL: /app/products/:trackedProductId/quick-start
 * Used for Edit Total Cost; first-time onboarding prefers the modal on the
 * product details page to avoid this route's loader latency.
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

  try {
    // Read-only open: do not create a profile until Save.
    const [profile, setup] = await Promise.all([
      quickStartService.getQuickStartProfile(
        session.shop,
        tracked.shopifyProductId,
      ),
      fetchShopSetupContext(admin, session.shop, [tracked.shopifyProductId]),
    ]);

    const enrichment = setup.products.get(tracked.shopifyProductId);
    const productTitle =
      enrichment?.title ?? tracked.shopifyProductId;

    return {
      trackedProductId: tracked.id,
      productTitle,
      currency: profile?.currency ?? setup.currency,
      totalCost: profile?.totalCost ?? null,
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

  const formData = await request.formData();
  const totalCostRaw = formData.get("totalCost");
  const currencyRaw = formData.get("currency");

  if (typeof totalCostRaw !== "string") {
    return { ok: false, error: "Enter a total product cost." };
  }

  try {
    const currency =
      (typeof currencyRaw === "string" && currencyRaw.trim()) ||
      getCachedShopCurrency(session.shop) ||
      (await resolveShopCurrency(admin, session.shop));

    await quickStartService.saveQuickStartCost({
      shop: session.shop,
      productId: tracked.shopifyProductId,
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
