import type { authenticate } from "~/shopify.server";
import {
  toProductEnrichment,
  type ShopifyProductEnrichment,
} from "~/modules/products/services/shopifyProductsService.server";

type AdminGraphql = Awaited<ReturnType<typeof authenticate.admin>>["admin"];

type SetupContextProductNode = {
  id: string;
  title: string;
  status: string;
  featuredImage?: { url: string; altText?: string | null } | null;
  variants?: {
    nodes?: Array<{
      id: string;
      title: string;
      price: string;
    } | null> | null;
  } | null;
};

type SetupContextResponse = {
  data?: {
    shop?: { currencyCode?: string };
    nodes?: Array<SetupContextProductNode | null>;
  };
  errors?: Array<{ message: string }>;
};

export type ShopSetupContext = {
  currency: string;
  products: Map<string, ShopifyProductEnrichment>;
};

/** In-memory currency cache (helps warm serverless instances). */
const currencyCache = new Map<string, { value: string; expiresAt: number }>();
const CURRENCY_TTL_MS = 60 * 60 * 1000;

export function getCachedShopCurrency(shop: string): string | null {
  const entry = currencyCache.get(shop);
  if (!entry || entry.expiresAt <= Date.now()) {
    return null;
  }
  return entry.value;
}

export function setCachedShopCurrency(shop: string, currency: string): void {
  currencyCache.set(shop, {
    value: currency,
    expiresAt: Date.now() + CURRENCY_TTL_MS,
  });
}

/**
 * One Shopify GraphQL round-trip for shop currency + product enrichment.
 * Prefer this over separate resolveShopCurrency + fetchProductsByIds calls.
 */
export async function fetchShopSetupContext(
  admin: AdminGraphql,
  shop: string,
  productIds: string[],
): Promise<ShopSetupContext> {
  const response = await admin.graphql(
    `#graphql
      query ShopSetupContext($ids: [ID!]!) {
        shop {
          currencyCode
        }
        nodes(ids: $ids) {
          ... on Product {
            id
            title
            status
            featuredImage {
              url
              altText
            }
            variants(first: 250) {
              nodes {
                id
                title
                price
              }
            }
          }
        }
      }
    `,
    { variables: { ids: productIds } },
  );

  const json = (await response.json()) as SetupContextResponse;

  if (json.errors?.length) {
    throw new Response("Unable to load shop setup context from Shopify.", {
      status: 502,
    });
  }

  const currencyCode = json.data?.shop?.currencyCode;
  if (!currencyCode) {
    throw new Response("Unable to resolve shop currency from Shopify.", {
      status: 502,
    });
  }

  setCachedShopCurrency(shop, currencyCode);

  const products = new Map<string, ShopifyProductEnrichment>();
  for (const node of json.data?.nodes ?? []) {
    if (node?.id && node.title != null) {
      products.set(node.id, toProductEnrichment(node));
    }
  }

  return { currency: currencyCode, products };
}
