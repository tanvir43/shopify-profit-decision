import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import prisma from "~/db.server";
import { resolveShopGid } from "~/lib/shopIdentity.server";
import { stopTrackingProduct } from "~/lib/stopTrackingProduct.server";
import { TrackedProductLimitExceededError } from "~/lib/trackedProductCapacity";
import { loadTrackedProductUsage } from "~/lib/trackedProductUsage.server";
import { ProductsPage } from "~/modules/products";
import type { StopTrackingActionData } from "~/modules/products/components/TrackedProductList";
import type { TrackProductsActionData } from "~/modules/products/hooks/useAddTrackedProducts";
import { ALREADY_TRACKED_MESSAGE } from "~/modules/products/hooks/useAddTrackedProducts";
import { loadTrackedProductWorkspace } from "~/modules/products/services/trackedProductWorkspace.server";
import { trackedProductService } from "~/modules/products/services/trackedProductService.server";
import { authenticate } from "~/shopify.server";

/**
 * Tracked Products Workspace.
 * Loads tracked product references from the database, then enriches
 * them with a single batched Shopify Admin GraphQL request at runtime.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  const shopGid = await resolveShopGid(admin);

  const [tracked, productUsage] = await Promise.all([
    trackedProductService.listTrackedProducts(session.shop),
    loadTrackedProductUsage(prisma, session.shop, shopGid),
  ]);

  return {
    trackedCount: tracked.length,
    trackedShopifyProductIds: tracked.map(
      (product) => product.shopifyProductId,
    ),
    productUsage: {
      currentCount: productUsage.currentCount,
      limit: productUsage.limit,
      isUnlimited: productUsage.isUnlimited,
      planDisplayName: productUsage.entitlement.displayName,
    },
    workspace: loadTrackedProductWorkspace(admin, tracked, session.shop),
  };
};

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<
  TrackProductsActionData | StopTrackingActionData
> => {
  const { session, admin } = await authenticate.admin(request);

  const formData = await request.formData();

  // TEMP-001 — temporary Launch Sprint testing helper; remove UI before App Store submission.
  // Deletes ProfitPilot data only (TrackedProduct + CostProfile + cascaded CostItems).
  // Does not call Shopify Admin Product APIs.
  if (formData.get("intent") === "stop-tracking") {
    const shopifyProductIdRaw = formData.get("shopifyProductId");

    if (
      typeof shopifyProductIdRaw !== "string" ||
      shopifyProductIdRaw.trim().length === 0
    ) {
      return {
        ok: false,
        error: "We couldn't stop tracking that product. Try again.",
      };
    }

    const shopifyProductId = shopifyProductIdRaw.trim();

    try {
      await stopTrackingProduct(prisma, session.shop, shopifyProductId);

      return { ok: true };
    } catch {
      return {
        ok: false,
        error: "We couldn't stop tracking that product. Try again.",
      };
    }
  }

  const productIdsRaw = formData.get("productIds");

  if (typeof productIdsRaw !== "string") {
    return { ok: false, error: "We couldn't track those products. Try again." };
  }

  let productIds: string[];
  try {
    const parsed: unknown = JSON.parse(productIdsRaw);
    if (!Array.isArray(parsed) || parsed.some((id) => typeof id !== "string")) {
      return {
        ok: false,
        error: "We couldn't track those products. Try again.",
      };
    }
    productIds = parsed;
  } catch {
    return { ok: false, error: "We couldn't track those products. Try again." };
  }

  try {
    const shopGid = await resolveShopGid(admin);
    const productUsage = await loadTrackedProductUsage(
      prisma,
      session.shop,
      shopGid,
    );

    if (!productUsage.hasActiveSubscription) {
      return {
        ok: false,
        error: "Choose an active plan before tracking products.",
      };
    }

    const newlyTracked = await trackedProductService.trackProducts(
      session.shop,
      productIds,
      {
        maxTrackedProducts: productUsage.limit,
        entitlement: productUsage.entitlement,
      },
    );

    if (newlyTracked === 0) {
      return { ok: false, error: ALREADY_TRACKED_MESSAGE };
    }

    return { ok: true, newlyTracked };
  } catch (error) {
    if (error instanceof TrackedProductLimitExceededError) {
      return {
        ok: false,
        error: error.message,
        code: error.code,
      };
    }

    return { ok: false, error: "We couldn't track those products. Try again." };
  }
};

export default function ProductsRoute() {
  const data = useLoaderData<typeof loader>();
  return <ProductsPage data={data} />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
