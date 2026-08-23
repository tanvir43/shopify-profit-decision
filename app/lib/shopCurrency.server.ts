import type { authenticate } from "~/shopify.server";

import {
  getCachedShopCurrency,
  setCachedShopCurrency,
} from "./shopSetupContext.server";

type AdminGraphql = Awaited<ReturnType<typeof authenticate.admin>>["admin"];

/**
 * Resolve the shop's ISO 4217 currency from Shopify Admin GraphQL.
 * Pass `shop` to enable a short-lived in-memory cache across warm invocations.
 */
export async function resolveShopCurrency(
  admin: AdminGraphql,
  shop?: string,
): Promise<string> {
  if (shop) {
    const cached = getCachedShopCurrency(shop);
    if (cached) {
      return cached;
    }
  }

  const response = await admin.graphql(
    `#graphql
      query ShopCurrency {
        shop {
          currencyCode
        }
      }
    `,
  );
  const json = (await response.json()) as {
    data?: { shop?: { currencyCode?: string } };
  };
  const currencyCode = json.data?.shop?.currencyCode;

  if (!currencyCode) {
    throw new Response("Unable to resolve shop currency from Shopify.", {
      status: 502,
    });
  }

  if (shop) {
    setCachedShopCurrency(shop, currencyCode);
  }

  return currencyCode;
}
