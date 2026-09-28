type ShopIdResponse = {
  data?: {
    shop?: {
      id?: string;
    };
  };
  errors?: Array<{ message: string }>;
};

/**
 * Resolve the Shopify shop GID used by the Partner API subscription query.
 */
export async function resolveShopGid(admin: {
  graphql: (query: string) => Promise<Response>;
}): Promise<string> {
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

  return shopJson.data.shop.id;
}
