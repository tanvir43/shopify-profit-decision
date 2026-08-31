/** Product-level cost profile scope (legacy rows and products without variants). */
export const PRODUCT_LEVEL_VARIANT_ID = "";

export function normalizeShopifyVariantId(
  shopifyVariantId: string | null | undefined,
): string {
  return shopifyVariantId?.trim() || PRODUCT_LEVEL_VARIANT_ID;
}
