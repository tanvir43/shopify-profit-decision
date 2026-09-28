import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { AppNavigation } from "~/components/AppNavigation";
import {
  buildHostedPricingPlansUrl,
  checkActiveSubscription,
} from "~/lib/partnerApi.server";
import { resolveShopGid } from "~/lib/shopIdentity.server";
import { authenticate } from "~/shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session, redirect } = await authenticate.admin(request);

  const shopId = await resolveShopGid(admin);
  const { hasActiveSubscription } = await checkActiveSubscription(shopId);

  if (!hasActiveSubscription) {
    const pricingUrl = buildHostedPricingPlansUrl(session.shop);
    return redirect(pricingUrl, { target: "_top" });
  }

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function AppLayout() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <AppNavigation />
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
