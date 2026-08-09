import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import prisma from "~/db.server";
import { ProductsPage } from "~/modules/products";
import type { StopTrackingActionData } from "~/modules/products/components/TrackedProductList";
import type { TrackProductsActionData } from "~/modules/products/hooks/useAddTrackedProducts";
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

  const tracked = await trackedProductService.listTrackedProducts(session.shop);

  return {
    trackedCount: tracked.length,
    workspace: loadTrackedProductWorkspace(admin, tracked),
  };
};

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<
  TrackProductsActionData | StopTrackingActionData
> => {
  const { session } = await authenticate.admin(request);

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
      // CostItem rows cascade when CostProfile is deleted.
      await prisma.costProfile.deleteMany({
        where: {
          shop: session.shop,
          productId: shopifyProductId,
        },
      });
      await trackedProductService.untrackProduct(
        session.shop,
        shopifyProductId,
      );

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
    if (
      !Array.isArray(parsed) ||
      parsed.some((id) => typeof id !== "string")
    ) {
      return { ok: false, error: "We couldn't track those products. Try again." };
    }
    productIds = parsed;
  } catch {
    return { ok: false, error: "We couldn't track those products. Try again." };
  }

  try {
    const newlyTracked = await trackedProductService.trackProducts(
      session.shop,
      productIds,
    );

    return { ok: true, newlyTracked };
  } catch {
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
