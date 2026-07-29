import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { QuickStartPage } from "~/modules/products";
import { authenticate } from "~/shopify.server";

/**
 * Quick Start placeholder (PP-0012).
 *
 * URL: /app/products/:trackedProductId/quick-start
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function QuickStartRoute() {
  return <QuickStartPage />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
