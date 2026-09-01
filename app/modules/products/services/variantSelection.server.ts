import type { authenticate } from "~/shopify.server";

import { costProfileService } from "~/modules/cost-profiles/services/costProfileService.server";

import { resolveActiveCostProfileVariantId } from "../lib/resolveProductDetailView";
import {
  resolveShopifyVariantIdForUpdate,
} from "../lib/variantContext";
import type { TrackedProduct } from "../types/TrackedProduct";
import { fetchProductsByIds } from "./shopifyProductsService.server";
import { trackedProductService } from "./trackedProductService.server";

type AdminGraphql = Awaited<ReturnType<typeof authenticate.admin>>["admin"];

export type TrackedProductVariantScope = {
  costProfileVariantId: string;
  shopifyVariantId: string | null;
};

async function loadTrackedProductVariantScope(
  admin: AdminGraphql,
  tracked: TrackedProduct,
): Promise<TrackedProductVariantScope> {
  const [products, profiles] = await Promise.all([
    fetchProductsByIds(admin, [tracked.shopifyProductId]),
    costProfileService.findAllForProduct(tracked.shopId, tracked.shopifyProductId),
  ]);
  const variants = products.get(tracked.shopifyProductId)?.variants ?? [];
  const costProfileVariantId = resolveActiveCostProfileVariantId({
    variants,
    profiles,
    selectedShopifyVariantId: tracked.selectedShopifyVariantId,
  });

  return {
    costProfileVariantId,
    shopifyVariantId: resolveShopifyVariantIdForUpdate(
      costProfileVariantId,
      variants,
      tracked.selectedShopifyVariantId,
    ),
  };
}

export async function resolveTrackedProductVariantScope(
  admin: AdminGraphql,
  tracked: TrackedProduct,
): Promise<TrackedProductVariantScope> {
  return loadTrackedProductVariantScope(admin, tracked);
}

export async function resolveTrackedProductVariantId(
  admin: AdminGraphql,
  tracked: TrackedProduct,
): Promise<string> {
  const scope = await loadTrackedProductVariantScope(admin, tracked);
  return scope.costProfileVariantId;
}

export async function resolveTrackedProductShopifyVariantId(
  admin: AdminGraphql,
  tracked: TrackedProduct,
): Promise<string | null> {
  const scope = await loadTrackedProductVariantScope(admin, tracked);
  return scope.shopifyVariantId;
}

/**
 * Verifies a Shopify variant belongs to a tracked product using live enrichment.
 * Never trust client-supplied variant IDs without this check.
 */
export async function verifyVariantBelongsToTrackedProduct(
  admin: AdminGraphql,
  shopId: string,
  trackedProductId: string,
  shopifyVariantId: string,
): Promise<{ shopifyProductId: string }> {
  const tracked = await trackedProductService.getTrackedProduct(
    shopId,
    trackedProductId,
  );

  if (!tracked) {
    throw new Response("Tracked product not found.", { status: 404 });
  }

  const products = await fetchProductsByIds(admin, [tracked.shopifyProductId]);
  const enrichment = products.get(tracked.shopifyProductId);
  const variantId = shopifyVariantId.trim();

  if (!enrichment?.variants.some((variant) => variant.id === variantId)) {
    throw new Response("Selected variant does not belong to this product.", {
      status: 400,
    });
  }

  return { shopifyProductId: tracked.shopifyProductId };
}

/**
 * Persists a validated variant selection for a tracked product.
 */
export async function saveTrackedProductVariantSelection(
  admin: AdminGraphql,
  shopId: string,
  trackedProductId: string,
  shopifyVariantId: string,
) {
  await verifyVariantBelongsToTrackedProduct(
    admin,
    shopId,
    trackedProductId,
    shopifyVariantId,
  );

  const updated = await trackedProductService.selectVariant(
    shopId,
    trackedProductId,
    shopifyVariantId.trim(),
  );

  if (!updated) {
    throw new Response("Tracked product not found.", { status: 404 });
  }

  return updated;
}
