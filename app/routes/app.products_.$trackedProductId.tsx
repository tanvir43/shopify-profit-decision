import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  isRouteErrorResponse,
  redirect,
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
  ProductVariantSelectionPage,
  type VariantSelectionActionData,
} from "~/modules/products";
import {
  buildVariantSelectionLoaderData,
  hasValidVariantSelection,
  resolveProductDetailView,
} from "~/modules/products/lib/resolveProductDetailView";
import { handleProductDetailsAction } from "~/modules/products/services/productDetailsActions.server";
import { loadProductDetailsEnrichment } from "~/modules/products/services/productDetailsEnrichment.server";
import { fetchProductsByIds } from "~/modules/products/services/shopifyProductsService.server";
import { trackedProductService } from "~/modules/products/services/trackedProductService.server";
import { saveTrackedProductVariantSelection } from "~/modules/products/services/variantSelection.server";
import { authenticate } from "~/shopify.server";

/**
 * Tracked product details — variant selection, onboarding, or Decision Workspace.
 *
 * URL: /app/products/:trackedProductId
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  const trackedProductId = params.trackedProductId?.trim();
  if (!trackedProductId) {
    throw new Response("Tracked product ID is required.", { status: 400 });
  }

  let tracked = await trackedProductService.getTrackedProduct(
    session.shop,
    trackedProductId,
  );

  if (!tracked) {
    throw new Response("Tracked product not found.", { status: 404 });
  }

  const [profiles, enrichmentMap] = await Promise.all([
    costProfileService.findAllForProduct(
      session.shop,
      tracked.shopifyProductId,
    ),
    fetchProductsByIds(admin, [tracked.shopifyProductId]),
  ]);

  const enrichment = enrichmentMap.get(tracked.shopifyProductId);
  const variants = enrichment?.variants ?? [];

  if (variants.length === 1 && tracked.selectedShopifyVariantId !== variants[0].id) {
    tracked =
      (await trackedProductService.selectVariant(
        session.shop,
        tracked.id,
        variants[0].id,
      )) ?? tracked;
  }

  const currency =
    profiles[0]?.currency ??
    getCachedShopCurrency(session.shop) ??
    (await resolveShopCurrency(admin, session.shop));

  const productTitle = enrichment?.title ?? tracked.shopifyProductId;
  const productStatus = enrichment?.status ?? "UNKNOWN";
  const imageUrl = enrichment?.imageUrl ?? null;
  const imageAlt = enrichment?.imageAlt ?? null;

  const viewInput = {
    trackedProductId: tracked.id,
    variants,
    profiles,
    selectedShopifyVariantId: tracked.selectedShopifyVariantId,
    currency,
    productTitle,
    productStatus,
    imageUrl,
    imageAlt,
  };

  const view = resolveProductDetailView(viewInput);

  // Wire Shopify variants into the product-detail route decision.
  // Workspace list variants are display-only; this loader re-fetches enrichment
  // and must gate onboarding when variants.length > 1 without a saved selection.
  if (
    variants.length > 1 &&
    !hasValidVariantSelection(variants, tracked.selectedShopifyVariantId) &&
    view.kind !== "dashboard"
  ) {
    const selection = buildVariantSelectionLoaderData({
      trackedProductId: tracked.id,
      variants,
      profiles,
      currency,
      productTitle,
      imageUrl,
      imageAlt,
    });

    return { view: "variant-selection" as const, ...selection };
  }

  if (view.kind === "variant-selection") {
    return { view: "variant-selection" as const, ...view };
  }

  if (view.kind === "onboarding") {
    return {
      view: "onboarding" as const,
      trackedProductId: view.trackedProductId,
      currency: view.currency,
      totalCost: view.totalCost,
      productTitle: view.productTitle,
      variant: view.variant,
    };
  }

  const costAmounts = emptyAmounts();
  for (const item of view.profile.items) {
    const type = categoryToCostItemType(item.category);
    if (costAmounts[type] === "") {
      costAmounts[type] = item.value;
    }
  }

  return {
    view: "dashboard" as const,
    trackedProductId: view.trackedProductId,
    mode: view.mode,
    shopifyVariantId: view.shopifyVariantId,
    variant: view.variant,
    productTitle: view.productTitle,
    productStatus: view.productStatus,
    imageUrl: view.imageUrl,
    imageAlt: view.imageAlt,
    currency: view.profile.currency,
    totalCost: view.profile.totalCost,
    sellingPrice: view.profile.sellingPrice,
    costAmounts,
    enrichment: loadProductDetailsEnrichment(
      admin,
      tracked.shopifyProductId,
    ),
  };
};

export const action = async (
  args: ActionFunctionArgs,
): Promise<VariantSelectionActionData | Awaited<ReturnType<typeof handleProductDetailsAction>>> => {
  const { request, params } = args;
  const { session, admin } = await authenticate.admin(request);

  const trackedProductId = params.trackedProductId?.trim();
  if (!trackedProductId) {
    return { ok: false, error: "We couldn't continue. Try again." };
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "select-variant") {
    const shopifyVariantId = formData.get("shopifyVariantId");
    if (typeof shopifyVariantId !== "string" || shopifyVariantId.trim().length === 0) {
      return { ok: false, error: "Select a variant to continue." };
    }

    try {
      await saveTrackedProductVariantSelection(
        admin,
        session.shop,
        trackedProductId,
        shopifyVariantId,
      );
    } catch (error) {
      if (error instanceof Response) {
        throw error;
      }
      return { ok: false, error: "We couldn't save your variant selection. Try again." };
    }

    throw redirect(`/app/products/${encodeURIComponent(trackedProductId)}`);
  }

  return handleProductDetailsAction(args, formData);
};

export default function ProductDetailsRoute() {
  const data = useLoaderData<typeof loader>();

  if (data.view === "variant-selection") {
    return <ProductVariantSelectionPage data={data} />;
  }

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
