import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { DetailedSetupPage } from "~/modules/products";
import { authenticate } from "~/shopify.server";

/**
 * Detailed Setup placeholder (PP-0013).
 *
 * URL: /app/products/:trackedProductId/detailed-setup
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function DetailedSetupRoute() {
  return <DetailedSetupPage />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
