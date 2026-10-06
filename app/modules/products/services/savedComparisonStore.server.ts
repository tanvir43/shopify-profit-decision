import type { PrismaClient } from "@prisma/client";

import {
  buildSavedComparisonPersistPayload,
  parseSavedComparisonName,
  type SavedComparisonActionData,
  type SavedComparisonItemInput,
  type SavedComparisonSummary,
} from "../lib/savedComparisons";

export type SavedComparisonRecord = {
  id: string;
  shop: string;
  name: string;
  items: Array<{
    trackedProductId: string;
    shopifyVariantId: string;
    position: number;
  }>;
};

export type { SavedComparisonActionData, SavedComparisonSummary };

/**
 * List Saved Comparisons for one shop. Never returns another shop's rows.
 */
export async function listSavedComparisonsForShop(
  db: PrismaClient,
  shop: string,
): Promise<SavedComparisonSummary[]> {
  const rows = await db.savedComparison.findMany({
    where: { shop },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { items: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    productCount: row._count.items,
  }));
}

/**
 * Load a Saved Comparison scoped to shop. Null when missing or foreign-owned.
 */
export async function getSavedComparisonForShop(
  db: PrismaClient,
  shop: string,
  savedComparisonId: string,
): Promise<SavedComparisonRecord | null> {
  const id = savedComparisonId.trim();
  if (!id) {
    return null;
  }

  const row = await db.savedComparison.findFirst({
    where: { id, shop },
    include: {
      items: { orderBy: { position: "asc" } },
    },
  });

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    shop: row.shop,
    name: row.name,
    items: row.items.map((item) => ({
      trackedProductId: item.trackedProductId,
      shopifyVariantId: item.shopifyVariantId,
      position: item.position,
    })),
  };
}

export async function createSavedComparisonRecord(
  db: PrismaClient,
  shop: string,
  name: string,
  items: readonly SavedComparisonItemInput[],
) {
  const payload = buildSavedComparisonPersistPayload(name, items);

  return db.savedComparison.create({
    data: {
      shop,
      name: payload.name,
      items: {
        create: payload.items.map((item) => ({
          trackedProductId: item.trackedProductId,
          shopifyVariantId: item.shopifyVariantId,
          position: item.position,
        })),
      },
    },
    include: {
      items: { orderBy: { position: "asc" } },
    },
  });
}

export async function renameSavedComparisonForShop(
  db: PrismaClient,
  shop: string,
  savedComparisonId: string,
  nameRaw: unknown,
): Promise<SavedComparisonActionData> {
  const parsed = parseSavedComparisonName(nameRaw);
  if (!parsed.ok) {
    return parsed;
  }

  const id = savedComparisonId.trim();
  if (!id) {
    return { ok: false, error: "We couldn't rename that saved comparison. Try again." };
  }

  const result = await db.savedComparison.updateMany({
    where: { id, shop },
    data: { name: parsed.name },
  });

  if (result.count === 0) {
    return { ok: false, error: "We couldn't rename that saved comparison. Try again." };
  }

  return { ok: true };
}

export async function deleteSavedComparisonForShop(
  db: PrismaClient,
  shop: string,
  savedComparisonId: string,
): Promise<SavedComparisonActionData> {
  const id = savedComparisonId.trim();
  if (!id) {
    return { ok: false, error: "We couldn't delete that saved comparison. Try again." };
  }

  const result = await db.savedComparison.deleteMany({
    where: { id, shop },
  });

  if (result.count === 0) {
    return { ok: false, error: "We couldn't delete that saved comparison. Try again." };
  }

  return { ok: true };
}
