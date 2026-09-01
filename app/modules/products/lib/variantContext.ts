import type { ShopifyProductVariantEnrichment } from "../services/shopifyProductsService.server";

/** Product-level cost profile scope (legacy rows and products without variants). */
export const PRODUCT_LEVEL_VARIANT_ID = "";

export type VariantContext = {
  shopifyVariantId: string;
  title: string | null;
  price: string | null;
};

export function normalizeShopifyVariantId(
  shopifyVariantId: string | null | undefined,
): string {
  return shopifyVariantId?.trim() || PRODUCT_LEVEL_VARIANT_ID;
}

export function resolveCostProfileVariantId(
  variants: ShopifyProductVariantEnrichment[],
  selectedShopifyVariantId: string | null | undefined,
): string {
  if (variants.length === 0) {
    return PRODUCT_LEVEL_VARIANT_ID;
  }

  if (variants.length === 1) {
    return variants[0].id;
  }

  const selected = selectedShopifyVariantId?.trim();
  if (selected && variants.some((variant) => variant.id === selected)) {
    return selected;
  }

  return PRODUCT_LEVEL_VARIANT_ID;
}

export function resolveShopifyVariantIdForUpdate(
  costProfileVariantId: string,
  variants: ShopifyProductVariantEnrichment[],
  selectedShopifyVariantId: string | null | undefined,
): string | null {
  if (costProfileVariantId !== PRODUCT_LEVEL_VARIANT_ID) {
    return costProfileVariantId;
  }

  if (variants.length === 1) {
    return variants[0].id;
  }

  const selected = selectedShopifyVariantId?.trim();
  if (selected && variants.some((variant) => variant.id === selected)) {
    return selected;
  }

  return null;
}

export function findVariantById(
  variants: ShopifyProductVariantEnrichment[],
  shopifyVariantId: string,
): ShopifyProductVariantEnrichment | null {
  return variants.find((variant) => variant.id === shopifyVariantId) ?? null;
}

export function toVariantContext(
  shopifyVariantId: string,
  variants: ShopifyProductVariantEnrichment[],
): VariantContext {
  if (shopifyVariantId === PRODUCT_LEVEL_VARIANT_ID) {
    const soleVariant = variants.length === 1 ? variants[0] : null;

    return {
      shopifyVariantId: PRODUCT_LEVEL_VARIANT_ID,
      title: null,
      price: soleVariant?.price ?? null,
    };
  }

  const variant = findVariantById(variants, shopifyVariantId);

  return {
    shopifyVariantId,
    title:
      variants.length > 1 ? (variant?.title ?? null) : null,
    price: variant?.price ?? null,
  };
}
