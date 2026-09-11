import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { buildHostedPricingPlansUrl } from "~/lib/partnerApi.server";
import { PricingPage } from "~/modules/pricing";
import { authenticate } from "~/shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, redirect } = await authenticate.admin(request);
  const pricingUrl = buildHostedPricingPlansUrl(session.shop);
  return redirect(pricingUrl, { target: "_top" });
};

export default function PricingRoute() {
  return <PricingPage />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
