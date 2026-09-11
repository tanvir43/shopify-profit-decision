import { AppProvider } from "@shopify/shopify-app-react-router/react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData } from "react-router";

import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));

  return { errors };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));

  return {
    errors,
  };
};

export default function Auth() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const { errors } = actionData || loaderData;

  return (
    <AppProvider embedded={false}>
      <s-page>
        <s-section heading="Install from Shopify">
          <p>
            Open or install this app from the Shopify Admin or the Shopify App
            Store. Manual shop-domain login is not available.
          </p>
          {errors.shop ? <p>{errors.shop}</p> : null}
        </s-section>
      </s-page>
    </AppProvider>
  );
}
