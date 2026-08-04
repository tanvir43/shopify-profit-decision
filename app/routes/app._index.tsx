import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "~/shopify.server";

/**
 * App Home (`/app`).
 * MVP merchants land on Products — the real entry point — not the empty Dashboard.
 * Dashboard module and route file remain for a future version.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const search = url.searchParams.toString();
  throw redirect(search ? `/app/products?${search}` : "/app/products");
};

export default function AppHomeRedirect() {
  return null;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
