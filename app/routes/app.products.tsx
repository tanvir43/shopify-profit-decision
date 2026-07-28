import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { ProductsPage } from "~/modules/products";
import { fetchProductsPage } from "~/modules/products/services/shopifyProductsService.server";
import { authenticate } from "~/shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const url = new URL(request.url);
  const after = url.searchParams.get("after");
  const before = url.searchParams.get("before");

  if (after && before) {
    throw new Response("Use either after or before for pagination, not both.", {
      status: 400,
    });
  }

  return fetchProductsPage(admin, { after, before });
};

export default function ProductsRoute() {
  const data = useLoaderData<typeof loader>();
  return <ProductsPage data={data} />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
