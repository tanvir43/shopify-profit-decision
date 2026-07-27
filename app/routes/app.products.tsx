import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { requireAdminAuth } from "~/lib/auth.server";
import { ProductsPage } from "~/modules/products";

export const loader = async (args: LoaderFunctionArgs) => {
  await requireAdminAuth(args);
  return null;
};

export default function ProductsRoute() {
  return <ProductsPage />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
