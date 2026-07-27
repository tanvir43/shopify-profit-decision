import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { requireAdminAuth } from "~/lib/auth.server";
import { DiscountsPage } from "~/modules/discounts";

export const loader = async (args: LoaderFunctionArgs) => {
  await requireAdminAuth(args);
  return null;
};

export default function DiscountsRoute() {
  return <DiscountsPage />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
