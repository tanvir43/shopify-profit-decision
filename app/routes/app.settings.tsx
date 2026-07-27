import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { requireAdminAuth } from "~/lib/auth.server";
import { SettingsPage } from "~/modules/settings";

export const loader = async (args: LoaderFunctionArgs) => {
  await requireAdminAuth(args);
  return null;
};

export default function SettingsRoute() {
  return <SettingsPage />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
