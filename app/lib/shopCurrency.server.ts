import type { authenticate } from "~/shopify.server";

type AdminGraphql = Awaited<ReturnType<typeof authenticate.admin>>["admin"];

/**
 * Resolve the shop's ISO 4217 currency from Shopify Admin GraphQL.
 */
export async function resolveShopCurrency(admin: AdminGraphql): Promise<string> {
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

  return currencyCode;
}
