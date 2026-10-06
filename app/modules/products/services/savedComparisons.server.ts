import prisma from "~/db.server";
import type { authenticate } from "~/shopify.server";

import type { CompareScenariosPageData } from "../lib/compareScenarios";
import {
  assertSavedComparisonItemsOwned,
  parseSavedComparisonFormData,
  restoreComparisonProductsFromSavedItems,
  type SavedComparisonActionData,
  type SavedComparisonItemInput,
} from "../lib/savedComparisons";
import { loadCompareScenariosPageData } from "./compareScenarios.server";
import {
  createSavedComparisonRecord,
  deleteSavedComparisonForShop,
  getSavedComparisonForShop,
  listSavedComparisonsForShop,
  renameSavedComparisonForShop,
} from "./savedComparisonStore.server";
import { trackedProductService } from "./trackedProductService.server";

type AdminGraphql = Awaited<ReturnType<typeof authenticate.admin>>["admin"];

export type { SavedComparisonActionData };

export async function listSavedComparisons(shop: string) {
  return listSavedComparisonsForShop(prisma, shop);
}

/**
 * Open a Saved Comparison through the existing compare loader.
 * Read-only — does not create SavedComparison rows.
 * Current prices and costs are resolved live.
 */
export async function loadCompareScenariosFromSavedComparison(
  admin: AdminGraphql,
  shop: string,
  savedComparisonId: string,
): Promise<CompareScenariosPageData> {
  const saved = await getSavedComparisonForShop(
    prisma,
    shop,
    savedComparisonId,
  );
  if (!saved) {
    return { products: [] };
  }

  const items: SavedComparisonItemInput[] = saved.items.map((item) => ({
    trackedProductId: item.trackedProductId,
    shopifyVariantId: item.shopifyVariantId,
  }));

  const pageData = await loadCompareScenariosPageData(
    admin,
    shop,
    items.map((item) => item.trackedProductId),
  );
  const restored = restoreComparisonProductsFromSavedItems(
    pageData.products,
    items,
  );

  return {
    products: restored.products,
    restoredComparison: {
      id: saved.id,
      name: saved.name,
      skippedUnavailableCount: restored.skippedCount,
    },
  };
}

export async function handleSaveComparisonAction(
  admin: AdminGraphql,
  shop: string,
  formData: FormData,
): Promise<SavedComparisonActionData> {
  const parsed = parseSavedComparisonFormData(formData);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  return saveComparisonForShop(admin, shop, parsed.name, parsed.items);
}

export async function saveComparisonForShop(
  admin: AdminGraphql,
  shop: string,
  name: string,
  items: SavedComparisonItemInput[],
): Promise<SavedComparisonActionData> {
  const tracked = await trackedProductService.listTrackedProducts(shop);
  const shopOwnedTrackedProductIds = new Set(
    tracked.map((product) => product.id),
  );
  const pageData = await loadCompareScenariosPageData(
    admin,
    shop,
    items.map((item) => item.trackedProductId),
  );
  const owned = assertSavedComparisonItemsOwned({
    shopOwnedTrackedProductIds,
    products: pageData.products,
    items,
  });

  if (!owned.ok) {
    return owned;
  }

  try {
    await createSavedComparisonRecord(prisma, shop, name, items);
    return { ok: true };
  } catch {
    return { ok: false, error: "We couldn't save this comparison. Try again." };
  }
}

export async function handleRenameSavedComparisonAction(
  shop: string,
  formData: FormData,
): Promise<SavedComparisonActionData> {
  const idRaw = formData.get("savedComparisonId");
  const id = typeof idRaw === "string" ? idRaw : "";
  return renameSavedComparisonForShop(prisma, shop, id, formData.get("name"));
}

export async function handleDeleteSavedComparisonAction(
  shop: string,
  formData: FormData,
): Promise<SavedComparisonActionData> {
  const idRaw = formData.get("savedComparisonId");
  const id = typeof idRaw === "string" ? idRaw : "";
  return deleteSavedComparisonForShop(prisma, shop, id);
}
