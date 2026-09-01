import type { ActionFunctionArgs } from "react-router";

import { validateSellingPrice } from "~/modules/cost-profiles/lib/validateSellingPrice";
import { validateQuickStartTotalCost } from "~/modules/cost-profiles/lib/validateQuickStartTotalCost";
import { costProfileService } from "~/modules/cost-profiles/services/costProfileService.server";
import { authenticate } from "~/shopify.server";

import { trackedProductService } from "./trackedProductService.server";
import {
  resolveTrackedProductVariantScope,
} from "./variantSelection.server";

type AdminGraphql = Awaited<ReturnType<typeof authenticate.admin>>["admin"];

export type ApplyToShopifyActionData =
  | { ok: true; message: string }
  | {
      ok: false;
      error: string;
      priceUpdated?: boolean;
      costUpdated?: boolean;
    };

type VariantShopifyContext = {
  shopifyProductId: string;
  shopifyVariantId: string;
  currentPrice: string | null;
  inventoryItemId: string | null;
};

type GraphqlUserError = { field?: string[] | null; message: string };

function collectUserErrors(
  userErrors: GraphqlUserError[] | null | undefined,
): string[] {
  return (userErrors ?? [])
    .map((error) => error.message?.trim())
    .filter((message): message is string => Boolean(message));
}

async function fetchVariantShopifyContext(
  admin: AdminGraphql,
  shopifyVariantId: string,
): Promise<VariantShopifyContext | null> {
  const response = await admin.graphql(
    `#graphql
      query VariantForShopifyUpdate($id: ID!) {
        productVariant(id: $id) {
          id
          price
          product {
            id
          }
          inventoryItem {
            id
          }
        }
      }
    `,
    { variables: { id: shopifyVariantId } },
  );

  const json = (await response.json()) as {
    data?: {
      productVariant?: {
        id: string;
        price: string;
        product?: { id: string } | null;
        inventoryItem?: { id: string } | null;
      } | null;
    };
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    console.error("VariantForShopifyUpdate GraphQL errors:", json.errors);
    return null;
  }

  const variant = json.data?.productVariant;
  if (!variant?.id || !variant.product?.id) {
    return null;
  }

  return {
    shopifyProductId: variant.product.id,
    shopifyVariantId: variant.id,
    currentPrice: variant.price ?? null,
    inventoryItemId: variant.inventoryItem?.id ?? null,
  };
}

async function updateVariantPrice(
  admin: AdminGraphql,
  shopifyProductId: string,
  shopifyVariantId: string,
  price: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const response = await admin.graphql(
    `#graphql
      mutation UpdateVariantPrice($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          productVariants {
            id
            price
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      variables: {
        productId: shopifyProductId,
        variants: [{ id: shopifyVariantId, price }],
      },
    },
  );

  const json = (await response.json()) as {
    data?: {
      productVariantsBulkUpdate?: {
        userErrors?: GraphqlUserError[];
      } | null;
    };
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    console.error("UpdateVariantPrice GraphQL errors:", json.errors);
    return {
      ok: false,
      error: "Shopify could not update the selling price. Try again.",
    };
  }

  const userErrors = collectUserErrors(
    json.data?.productVariantsBulkUpdate?.userErrors,
  );

  if (userErrors.length > 0) {
    console.error("UpdateVariantPrice userErrors:", userErrors);
    return {
      ok: false,
      error: "Shopify could not update the selling price. Try again.",
    };
  }

  return { ok: true };
}

async function updateInventoryItemCost(
  admin: AdminGraphql,
  inventoryItemId: string,
  cost: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const response = await admin.graphql(
    `#graphql
      mutation UpdateInventoryItemCost($id: ID!, $input: InventoryItemInput!) {
        inventoryItemUpdate(id: $id, input: $input) {
          inventoryItem {
            id
            unitCost {
              amount
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      variables: {
        id: inventoryItemId,
        input: { cost },
      },
    },
  );

  const json = (await response.json()) as {
    data?: {
      inventoryItemUpdate?: {
        userErrors?: GraphqlUserError[];
      } | null;
    };
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    console.error("UpdateInventoryItemCost GraphQL errors:", json.errors);
    return {
      ok: false,
      error: "Shopify could not update the product cost. Try again.",
    };
  }

  const userErrors = collectUserErrors(
    json.data?.inventoryItemUpdate?.userErrors,
  );

  if (userErrors.length > 0) {
    console.error("UpdateInventoryItemCost userErrors:", userErrors);
    return {
      ok: false,
      error: "Shopify could not update the product cost. Try again.",
    };
  }

  return { ok: true };
}

function findProfileForVariant(
  profiles: Awaited<ReturnType<typeof costProfileService.findAllForProduct>>,
  shopifyVariantId: string,
) {
  return (
    profiles.find((profile) => profile.shopifyVariantId === shopifyVariantId) ??
    null
  );
}

/**
 * Applies the merchant's evaluated selling price and saved product cost to the
 * selected Shopify variant. Variant scope is resolved server-side — never trust the client.
 */
export async function handleApplyToShopifyAction(
  { request, params }: ActionFunctionArgs,
  formData: FormData,
): Promise<ApplyToShopifyActionData> {
  const { session, admin } = await authenticate.admin(request);

  const trackedProductId = params.trackedProductId?.trim();
  if (!trackedProductId) {
    return {
      ok: false,
      error: "We couldn't update Shopify. Try again.",
    };
  }

  const tracked = await trackedProductService.getTrackedProduct(
    session.shop,
    trackedProductId,
  );

  if (!tracked) {
    return {
      ok: false,
      error: "We couldn't update Shopify. Try again.",
    };
  }

  const { costProfileVariantId, shopifyVariantId } =
    await resolveTrackedProductVariantScope(admin, tracked);

  if (!shopifyVariantId) {
    return {
      ok: false,
      error:
        "Select a valid Shopify variant before applying changes to your store.",
    };
  }

  if (tracked.shopifyProductId.trim().length === 0) {
    return {
      ok: false,
      error: "We couldn't update Shopify. Try again.",
    };
  }

  const profiles = await costProfileService.findAllForProduct(
    session.shop,
    tracked.shopifyProductId,
  );
  const profile = findProfileForVariant(profiles, costProfileVariantId);

  if (!profile) {
    return {
      ok: false,
      error: "Add product cost before applying changes to Shopify.",
    };
  }

  const sellingPriceRaw = formData.get("sellingPrice");
  if (typeof sellingPriceRaw !== "string") {
    return {
      ok: false,
      error: "Set a selling price before applying changes to Shopify.",
    };
  }

  const sellingPriceResult = validateSellingPrice(sellingPriceRaw);
  if (!sellingPriceResult.ok) {
    return {
      ok: false,
      error: sellingPriceResult.message,
    };
  }

  const costResult = validateQuickStartTotalCost(profile.totalCost ?? "");
  if (!costResult.ok) {
    return {
      ok: false,
      error: "Add product cost before applying changes to Shopify.",
    };
  }

  const sellingPrice = sellingPriceResult.value;
  const productCost = costResult.value;

  const variantContext = await fetchVariantShopifyContext(
    admin,
    shopifyVariantId,
  );

  if (!variantContext) {
    return {
      ok: false,
      error:
        "The selected variant could not be found in Shopify. Refresh and try again.",
    };
  }

  if (variantContext.shopifyProductId !== tracked.shopifyProductId) {
    return {
      ok: false,
      error: "The selected variant does not belong to this product.",
    };
  }

  if (!variantContext.inventoryItemId) {
    return {
      ok: false,
      error:
        "Shopify inventory details are unavailable for this variant. Try again later.",
    };
  }

  const priceUpdatedResult = await updateVariantPrice(
    admin,
    variantContext.shopifyProductId,
    variantContext.shopifyVariantId,
    sellingPrice,
  );

  if (!priceUpdatedResult.ok) {
    return {
      ok: false,
      error: priceUpdatedResult.error,
      priceUpdated: false,
      costUpdated: false,
    };
  }

  const costUpdatedResult = await updateInventoryItemCost(
    admin,
    variantContext.inventoryItemId,
    productCost,
  );

  if (!costUpdatedResult.ok) {
    return {
      ok: false,
      error:
        "Shopify selling price was updated, but product cost could not be updated. Check your Shopify permissions and try again.",
      priceUpdated: true,
      costUpdated: false,
    };
  }

  return {
    ok: true,
    message: "Shopify product price and cost updated successfully.",
  };
}
