import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { ProductsPage } from "~/modules/products";
import type { TrackProductsActionData } from "~/modules/products/hooks/useAddTrackedProducts";
import { trackedProductService } from "~/modules/products/services/trackedProductService.server";
import { authenticate } from "~/shopify.server";

function formatTrackedAt(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/**
 * Tracked Products Workspace.
 * Loads merchant-chosen product references only — no Shopify product fetch.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const tracked = await trackedProductService.listTrackedProducts(session.shop);

  return {
    products: tracked.map((product) => ({
      id: product.id,
      shopifyProductId: product.shopifyProductId,
      trackedAt: formatTrackedAt(product.trackedAt),
    })),
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
