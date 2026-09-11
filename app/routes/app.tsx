import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { AppNavigation } from "~/components/AppNavigation";
import {
  buildHostedPricingPlansUrl,
  checkActiveSubscription,
} from "~/lib/partnerApi.server";
import { authenticate } from "~/shopify.server";

type ShopIdResponse = {
  data?: {
    shop?: {
      id?: string;
    };
  };
  errors?: Array<{ message: string }>;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session, redirect } = await authenticate.admin(request);

  const shopResponse = await admin.graphql(
    `#graphql
      query ShopId {
        shop {
          id
        }
      }
    `,
  );

  const shopJson = (await shopResponse.json()) as ShopIdResponse;

  if (shopJson.errors?.length || !shopJson.data?.shop?.id) {
    throw new Response("Unable to resolve shop identity from Shopify.", {
      status: 502,
    });
  }

  const shopId = shopJson.data.shop.id;
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
