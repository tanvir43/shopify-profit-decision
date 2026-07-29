import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { ProductsPage } from "~/modules/products";
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
}: ActionFunctionArgs): Promise<TrackProductsActionData> => {
  const { session } = await authenticate.admin(request);

  const formData = await request.formData();
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
