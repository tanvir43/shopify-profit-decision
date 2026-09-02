import type { authenticate } from "~/shopify.server";

import { normalizeShopMoneyAmount } from "../lib/normalizeShopMoneyAmount";
import type { ProductsPageData, ProductsPageInfo, ProductSummary } from "../types";

export const PRODUCTS_PAGE_SIZE = 25;

export type { ProductsPageData, ProductsPageInfo };

type AdminGraphql = Awaited<ReturnType<typeof authenticate.admin>>["admin"];

type ProductsPaginationParams = {
  after?: string | null;
  before?: string | null;
};

type ShopifyProductNode = {
  id: string;
  title: string;
  status: string;
  featuredImage?: { url: string; altText?: string | null } | null;
};

export type ShopifyProductVariantEnrichment = {
  id: string;
  title: string;
  price: string;
};

export type ShopifyProductEnrichment = {
  title: string;
  status: string;
  imageUrl: string | null;
  imageAlt: string | null;
  variants: ShopifyProductVariantEnrichment[];
};

type ShopifyVariantNode = {
  id: string;
  title: string;
  price: string;
};

type ShopifyProductByIdNode = {
  id: string;
  title: string;
  status: string;
  featuredImage?: { url: string; altText?: string | null } | null;
  variants?: {
    nodes?: Array<ShopifyVariantNode | null> | null;
  } | null;
} | null;

type ShopifyProductsResponse = {
  data?: {
    products?: {
      edges?: Array<{ node: ShopifyProductNode }>;
      pageInfo?: ProductsPageInfo;
    };
  };
  errors?: Array<{ message: string }>;
};

function toProductSummary(node: ShopifyProductNode): ProductSummary {
  return {
    id: node.id,
    title: node.title,
    status: node.status,
    featuredImageUrl: node.featuredImage?.url ?? null,
    totalVariants: 0,
  };
}

/**
 * Read-only product list from Shopify Admin GraphQL.
 * Products are not persisted — Shopify remains the source of truth.
 */
export async function fetchProductsPage(
  admin: AdminGraphql,
  params: ProductsPaginationParams = {},
): Promise<ProductsPageData> {
  const { after, before } = params;

  const variables = before
    ? { last: PRODUCTS_PAGE_SIZE, before }
    : { first: PRODUCTS_PAGE_SIZE, after: after ?? null };

  const response = await admin.graphql(
    `#graphql
      query ProductsList($first: Int, $after: String, $last: Int, $before: String) {
        products(first: $first, after: $after, last: $last, before: $before) {
          edges {
            node {
              id
              title
              status
              featuredImage {
                url
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }
    `,
    { variables },
  );

  const json = (await response.json()) as ShopifyProductsResponse;

  if (json.errors?.length) {
    throw new Response("Unable to load products from Shopify.", { status: 502 });
  }

  const productsConnection = json.data?.products;
  const edges = productsConnection?.edges ?? [];
  const pageInfo = productsConnection?.pageInfo ?? {
    hasNextPage: false,
    hasPreviousPage: false,
    startCursor: null,
    endCursor: null,
  };

  return {
    products: edges.map((edge) => toProductSummary(edge.node)),
    pageInfo,
  };
}

type ShopifyNodesResponse = {
  data?: {
    nodes?: ShopifyProductByIdNode[];
  };
  errors?: Array<{ message: string }>;
};

function toVariantEnrichment(
  node: ShopifyVariantNode,
): ShopifyProductVariantEnrichment {
  return {
    id: node.id,
    title: node.title,
    price: node.price,
  };
}

function toProductVariants(
  node: NonNullable<ShopifyProductByIdNode>,
): ShopifyProductVariantEnrichment[] {
  const variantNodes = node.variants?.nodes ?? [];
  const variants: ShopifyProductVariantEnrichment[] = [];

  for (const variant of variantNodes) {
    if (variant?.id && variant.title != null && variant.price != null) {
      variants.push(toVariantEnrichment(variant));
    }
  }

  return variants;
}

/** Maps a Shopify Product node into runtime enrichment (not persisted). */
export function toProductEnrichment(
  node: NonNullable<ShopifyProductByIdNode>,
): ShopifyProductEnrichment {
  return {
    title: node.title,
    status: node.status,
    imageUrl: node.featuredImage?.url ?? null,
    imageAlt: node.featuredImage?.altText ?? null,
    variants: toProductVariants(node),
  };
}

/**
 * Batched Shopify product lookup by GID.
 * Returns a map keyed by product id. Missing or deleted products are omitted.
 */
export async function fetchProductsByIds(
  admin: AdminGraphql,
  productIds: string[],
): Promise<Map<string, ShopifyProductEnrichment>> {
  if (productIds.length === 0) {
    return new Map();
  }

  const response = await admin.graphql(
    `#graphql
      query TrackedProductsEnrichment($ids: [ID!]!) {
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

  const json = (await response.json()) as ShopifyNodesResponse;

  if (json.errors?.length) {
    throw new Error("Unable to load product details from Shopify.");
  }

  const products = new Map<string, ShopifyProductEnrichment>();

  for (const node of json.data?.nodes ?? []) {
    if (node?.id && node.title != null) {
      products.set(node.id, toProductEnrichment(node));
    }
  }

  return products;
}

type VariantUnitCostResponse = {
  data?: {
    productVariant?: {
      inventoryItem?: {
        unitCost?: {
          amount?: string | null;
        } | null;
      } | null;
    } | null;
  };
  errors?: Array<{ message: string }>;
};

/**
 * Reads the inventory unit cost Shopify already stores for a variant.
 * Returns a normalized amount when present and valid, otherwise null.
 */
export async function fetchVariantUnitCost(
  admin: AdminGraphql,
  shopifyVariantId: string,
): Promise<string | null> {
  const variantId = shopifyVariantId.trim();
  if (!variantId) {
    return null;
  }

  const response = await admin.graphql(
    `#graphql
      query VariantInventoryUnitCost($id: ID!) {
        productVariant(id: $id) {
          inventoryItem {
            unitCost {
              amount
            }
          }
        }
      }
    `,
    { variables: { id: variantId } },
  );

  const json = (await response.json()) as VariantUnitCostResponse;

  if (json.errors?.length) {
    console.error("VariantInventoryUnitCost GraphQL errors:", json.errors);
    return null;
  }

  const amount = json.data?.productVariant?.inventoryItem?.unitCost?.amount;
  return normalizeShopMoneyAmount(
    typeof amount === "string" ? amount : null,
  );
}
