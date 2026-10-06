import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";

import type { CostProfile } from "../modules/cost-profiles/types/CostProfile";
import { APPLY_COMPARISON_PRICES_INTENT } from "../modules/products/lib/compareApplyToShopify";
import {
  buildComparisonProduct,
  resolveActiveComparisonSnapshot,
  type ComparisonProduct,
} from "../modules/products/lib/compareScenarios";
import {
  compareScenariosHref,
  parseCompareScenarioIds,
} from "../modules/products/lib/productStatus";
import {
  assertSavedComparisonItemsOwned,
  buildSaveComparisonFormPayload,
  buildSavedComparisonItemsFromSnapshots,
  buildSavedComparisonPersistPayload,
  compareSavedComparisonHref,
  hasSavedComparisonSnapshotFields,
  normalizeSavedComparisonItems,
  parseSavedComparisonFormData,
  parseSavedComparisonId,
  parseSavedComparisonItems,
  parseSavedComparisonName,
  restoreComparisonProductsFromSavedItems,
  SAVE_COMPARISON_INTENT,
  SAVED_COMPARISON_NAME_MAX_LENGTH,
  savedComparisonMutationKind,
  type SavedComparisonItemInput,
} from "../modules/products/lib/savedComparisons";
import { EMPTY_STRATEGY_INPUTS } from "../modules/products/lib/simulateProjectedOutcome";
import {
  createSavedComparisonRecord,
  deleteSavedComparisonForShop,
  getSavedComparisonForShop,
  listSavedComparisonsForShop,
  renameSavedComparisonForShop,
} from "../modules/products/services/savedComparisonStore.server";

const shopA = "shop-a.myshopify.com";
const shopB = "shop-b.myshopify.com";

describe("savedComparisonMutationKind", () => {
  it("only Save / Rename / Delete write SavedComparison records", () => {
    assert.equal(savedComparisonMutationKind(SAVE_COMPARISON_INTENT), "create");
    assert.equal(
      savedComparisonMutationKind("rename-saved-comparison"),
      "rename",
    );
    assert.equal(
      savedComparisonMutationKind("delete-saved-comparison"),
      "delete",
    );
  });

  it("changing simulation strategies does not write SavedComparison records", () => {
    assert.equal(savedComparisonMutationKind("discount"), null);
    assert.equal(savedComparisonMutationKind("coupon"), null);
    assert.equal(savedComparisonMutationKind("free_shipping"), null);
    assert.equal(savedComparisonMutationKind("quick-start-save"), null);
    assert.equal(savedComparisonMutationKind("detailed-setup-save"), null);
    assert.equal(savedComparisonMutationKind("select-variant"), null);
  });

  it("Apply prices to Shopify does not write SavedComparison records", () => {
    assert.equal(savedComparisonMutationKind(APPLY_COMPARISON_PRICES_INTENT), null);
    assert.equal(savedComparisonMutationKind("apply-to-shopify"), null);
  });
});

describe("parseSavedComparisonName", () => {
  it("rejects invalid and blank names", () => {
    assert.equal(parseSavedComparisonName("").ok, false);
    assert.equal(parseSavedComparisonName("   ").ok, false);
    assert.equal(parseSavedComparisonName(null).ok, false);
    assert.equal(parseSavedComparisonName(123).ok, false);
  });

  it("trims whitespace and accepts a merchant-provided name", () => {
    assert.deepEqual(parseSavedComparisonName("  Summer Promotion  "), {
      ok: true,
      name: "Summer Promotion",
    });
  });

  it("rejects names longer than the project maximum", () => {
    const tooLong = "x".repeat(SAVED_COMPARISON_NAME_MAX_LENGTH + 1);
    assert.equal(parseSavedComparisonName(tooLong).ok, false);
    assert.deepEqual(
      parseSavedComparisonName("x".repeat(SAVED_COMPARISON_NAME_MAX_LENGTH)),
      { ok: true, name: "x".repeat(SAVED_COMPARISON_NAME_MAX_LENGTH) },
    );
  });
});

describe("parseSavedComparisonItems", () => {
  it("rejects an empty comparison", () => {
    assert.equal(parseSavedComparisonItems("[]").ok, false);
    assert.equal(parseSavedComparisonItems([]).ok, false);
    assert.equal(parseSavedComparisonItems(null).ok, false);
  });

  it("rejects duplicate tracked products in one submitted group", () => {
    const result = parseSavedComparisonItems([
      { trackedProductId: "tp_1", shopifyVariantId: "var_black" },
      { trackedProductId: "tp_1", shopifyVariantId: "var_red" },
    ]);

    assert.equal(result.ok, false);
  });

  it("rejects items without a selected variant", () => {
    const result = parseSavedComparisonItems([
      { trackedProductId: "tp_1", shopifyVariantId: "  " },
    ]);

    assert.equal(result.ok, false);
  });

  it("parses multiple product + variant pairs in order", () => {
    const result = parseSavedComparisonItems(
      JSON.stringify([
        { trackedProductId: "tp_a", shopifyVariantId: "var_black" },
        { trackedProductId: "tp_b", shopifyVariantId: "var_default" },
        { trackedProductId: "tp_c", shopifyVariantId: "var_500ml" },
      ]),
    );

    assert.deepEqual(result, {
      ok: true,
      items: [
        { trackedProductId: "tp_a", shopifyVariantId: "var_black" },
        { trackedProductId: "tp_b", shopifyVariantId: "var_default" },
        { trackedProductId: "tp_c", shopifyVariantId: "var_500ml" },
      ],
    });
  });
});

describe("buildSavedComparisonPersistPayload", () => {
  it("persists only name, tracked products, selected variants, and position", () => {
    const payload = buildSavedComparisonPersistPayload("Summer Promotion", [
      { trackedProductId: "tp_a", shopifyVariantId: "var_black" },
      { trackedProductId: "tp_b", shopifyVariantId: "var_default" },
    ]);

    assert.deepEqual(payload, {
      name: "Summer Promotion",
      items: [
        {
          trackedProductId: "tp_a",
          shopifyVariantId: "var_black",
          position: 0,
        },
        {
          trackedProductId: "tp_b",
          shopifyVariantId: "var_default",
          position: 1,
        },
      ],
    });
    assert.equal(hasSavedComparisonSnapshotFields(payload), false);
  });

  it("does not persist Decision Strategies, prices, costs, or simulation results", () => {
    const payload = buildSavedComparisonPersistPayload("Summer Promotion", [
      { trackedProductId: "tp_a", shopifyVariantId: "var_black" },
    ]);
    const json = JSON.stringify(payload);

    assert.equal(json.includes("discount"), false);
    assert.equal(json.includes("coupon"), false);
    assert.equal(json.includes("cashback"), false);
    assert.equal(json.includes("currentPrice"), false);
    assert.equal(json.includes("sellingPrice"), false);
    assert.equal(json.includes("totalCost"), false);
    assert.equal(json.includes("profit"), false);
    assert.equal(json.includes("margin"), false);
    assert.equal(json.includes("simulated"), false);
    assert.deepEqual(Object.keys(payload.items[0]).sort(), [
      "position",
      "shopifyVariantId",
      "trackedProductId",
    ]);
  });
});

describe("parseSavedComparisonFormData", () => {
  it("reads an explicit Save comparison submission", () => {
    const formData = new FormData();
    const payload = buildSaveComparisonFormPayload("Summer Promotion", [
      { trackedProductId: "tp_a", shopifyVariantId: "var_black" },
    ]);
    for (const [key, value] of Object.entries(payload)) {
      formData.set(key, value);
    }

    assert.deepEqual(parseSavedComparisonFormData(formData), {
      ok: true,
      name: "Summer Promotion",
      items: [{ trackedProductId: "tp_a", shopifyVariantId: "var_black" }],
    });
    assert.equal(formData.get("intent"), SAVE_COMPARISON_INTENT);
    assert.equal(formData.has("strategies"), false);
    assert.equal(formData.has("discount"), false);
  });
});

describe("assertSavedComparisonItemsOwned", () => {
  const products = comparisonProducts();

  it("accepts shop-owned products whose variants belong to them", () => {
    const result = assertSavedComparisonItemsOwned({
      shopOwnedTrackedProductIds: new Set(["tp_shirt", "tp_bottle"]),
      products: [products.shirt, products.bottle],
      items: [
        { trackedProductId: "tp_shirt", shopifyVariantId: "var_black" },
        { trackedProductId: "tp_bottle", shopifyVariantId: "var_500ml" },
      ],
    });

    assert.deepEqual(result, { ok: true });
  });

  it("rejects a tracked product that does not belong to the authenticated shop", () => {
    const result = assertSavedComparisonItemsOwned({
      shopOwnedTrackedProductIds: new Set(["tp_shirt"]),
      products: [products.shirt],
      items: [
        { trackedProductId: "tp_foreign", shopifyVariantId: "var_black" },
      ],
    });

    assert.equal(result.ok, false);
  });

  it("rejects a variant that does not belong to the expected tracked product", () => {
    const result = assertSavedComparisonItemsOwned({
      shopOwnedTrackedProductIds: new Set(["tp_shirt", "tp_bottle"]),
      products: [products.shirt, products.bottle],
      items: [
        { trackedProductId: "tp_shirt", shopifyVariantId: "var_500ml" },
      ],
    });

    assert.equal(result.ok, false);
  });
});

describe("restoreComparisonProductsFromSavedItems", () => {
  it("restores saved products and the selected variant for each item", () => {
    const products = comparisonProducts();
    const restored = restoreComparisonProductsFromSavedItems(
      [products.shirt, products.bottle],
      [
        { trackedProductId: "tp_bottle", shopifyVariantId: "var_500ml" },
        { trackedProductId: "tp_shirt", shopifyVariantId: "var_black" },
      ],
    );

    assert.deepEqual(
      restored.products.map((product) => product.trackedProductId),
      ["tp_bottle", "tp_shirt"],
    );
    assert.equal(restored.products[0].defaultVariantId, "var_500ml");
    assert.equal(restored.products[1].defaultVariantId, "var_black");
    assert.equal(restored.skippedCount, 0);

    const shirtSnapshot = resolveActiveComparisonSnapshot(restored.products[1]);
    assert.equal(shirtSnapshot.variantId, "var_black");
    assert.equal(shirtSnapshot.variantTitle, "Black / Medium");
  });

  it("loads current price and cost from live product data, not stored snapshots", () => {
    const live = buildComparisonProduct({
      trackedProductId: "tp_shirt",
      title: "Classic T-Shirt",
      imageUrl: null,
      imageAlt: null,
      currency: "USD",
      variants: [
        {
          id: "var_black",
          title: "Black / Medium",
          price: "64.00",
          unitCost: "21.00",
        },
      ],
      profiles: [
        costProfile({
          shopifyVariantId: "var_black",
          totalCost: "21.00",
          sellingPrice: "64.00",
        }),
      ],
      selectedShopifyVariantId: null,
    });

    const restored = restoreComparisonProductsFromSavedItems(
      [live],
      [{ trackedProductId: "tp_shirt", shopifyVariantId: "var_black" }],
    );
    const snapshot = resolveActiveComparisonSnapshot(restored.products[0]);

    assert.equal(snapshot.currentPrice, "64.00");
    assert.equal(snapshot.effectiveCost, "21.00");
    assert.equal(
      JSON.stringify(restored).includes("savedPrice"),
      false,
    );
  });

  it("does not restore Decision Strategies — compare starts from existing defaults", () => {
    const products = comparisonProducts();
    const restored = restoreComparisonProductsFromSavedItems(
      [products.shirt],
      [{ trackedProductId: "tp_shirt", shopifyVariantId: "var_black" }],
    );

    assert.equal("strategies" in restored, false);
    assert.equal("fields" in restored, false);
    assert.deepEqual(EMPTY_STRATEGY_INPUTS.fields.discount, {
      type: "percentage",
      value: "",
    });
    assert.equal(EMPTY_STRATEGY_INPUTS.fields.coupon.value, "");
    assert.equal(EMPTY_STRATEGY_INPUTS.customStrategies.length, 0);
  });

  it("skips a deleted saved variant instead of substituting a sibling variant", () => {
    const shoes = multiVariantShoes();
    const restored = restoreComparisonProductsFromSavedItems(
      [shoes],
      [{ trackedProductId: "tp_shoes", shopifyVariantId: "var_deleted" }],
    );

    assert.deepEqual(restored.products, []);
    assert.equal(restored.skippedCount, 1);
    assert.notEqual(shoes.defaultVariantId, "var_deleted");
  });

  it("restores remaining valid items when one saved item is stale", () => {
    const products = comparisonProducts();
    const restored = restoreComparisonProductsFromSavedItems(
      [products.shirt, products.bottle],
      [
        { trackedProductId: "tp_missing", shopifyVariantId: "var_gone" },
        { trackedProductId: "tp_shirt", shopifyVariantId: "var_black" },
        { trackedProductId: "tp_bottle", shopifyVariantId: "var_deleted" },
      ],
    );

    assert.deepEqual(
      restored.products.map((product) => product.trackedProductId),
      ["tp_shirt"],
    );
    assert.equal(restored.products[0].defaultVariantId, "var_black");
    assert.equal(restored.skippedCount, 2);
  });
});

describe("saved comparison hrefs", () => {
  it("opens through the existing Compare pricing scenarios route", () => {
    assert.equal(
      compareSavedComparisonHref("sc_1"),
      "/app/products/compare?saved=sc_1",
    );
    assert.equal(
      parseSavedComparisonId(new URLSearchParams("saved=sc_1")),
      "sc_1",
    );
  });

  it("keeps the existing manual Compare flow independent of saved IDs", () => {
    assert.equal(
      compareScenariosHref(["tp_1", "tp_2"]),
      "/app/products/compare?ids=tp_1%2Ctp_2",
    );
    assert.deepEqual(
      parseCompareScenarioIds(new URLSearchParams("ids=tp_1,tp_2")),
      ["tp_1", "tp_2"],
    );
    assert.equal(
      parseSavedComparisonId(new URLSearchParams("ids=tp_1,tp_2")),
      null,
    );
    assert.deepEqual(
      parseCompareScenarioIds(new URLSearchParams("saved=sc_1")),
      [],
    );
  });
});

describe("saved comparison store", () => {
  it("saves a multi-product comparison with selected variant IDs", async () => {
    const harness = createSavedComparisonHarness(seededCatalog());
    const created = await createSavedComparisonRecord(harness.prisma, shopA, "Summer Promotion", [
      { trackedProductId: "tp_shirt", shopifyVariantId: "var_black" },
      { trackedProductId: "tp_bottle", shopifyVariantId: "var_500ml" },
    ]);

    assert.equal(created.shop, shopA);
    assert.equal(created.name, "Summer Promotion");
    assert.deepEqual(
      created.items.map((item) => ({
        trackedProductId: item.trackedProductId,
        shopifyVariantId: item.shopifyVariantId,
        position: item.position,
      })),
      [
        {
          trackedProductId: "tp_shirt",
          shopifyVariantId: "var_black",
          position: 0,
        },
        {
          trackedProductId: "tp_bottle",
          shopifyVariantId: "var_500ml",
          position: 1,
        },
      ],
    );
    assert.equal(harness.savedComparisons.length, 1);
    assert.equal(harness.savedComparisonItems.length, 2);
  });

  it("scopes list and open to the authenticated shop", async () => {
    const harness = createSavedComparisonHarness(seededCatalog());
    const owned = await createSavedComparisonRecord(
      harness.prisma,
      shopA,
      "Summer Promotion",
      [{ trackedProductId: "tp_shirt", shopifyVariantId: "var_black" }],
    );
    await createSavedComparisonRecord(
      harness.prisma,
      shopB,
      "Other Shop Group",
      [{ trackedProductId: "tp_foreign", shopifyVariantId: "var_other" }],
    );

    const listed = await listSavedComparisonsForShop(harness.prisma, shopA);
    assert.deepEqual(
      listed.map((row) => row.name),
      ["Summer Promotion"],
    );

    const opened = await getSavedComparisonForShop(
      harness.prisma,
      shopA,
      owned.id,
    );
    assert.equal(opened?.name, "Summer Promotion");
    assert.equal(harness.savedComparisons.length, 2);
  });

  it("does not let another shop open, rename, or delete a comparison", async () => {
    const harness = createSavedComparisonHarness(seededCatalog());
    const owned = await createSavedComparisonRecord(
      harness.prisma,
      shopA,
      "Summer Promotion",
      [{ trackedProductId: "tp_shirt", shopifyVariantId: "var_black" }],
    );

    const opened = await getSavedComparisonForShop(
      harness.prisma,
      shopB,
      owned.id,
    );
    assert.equal(opened, null);

    const renamed = await renameSavedComparisonForShop(
      harness.prisma,
      shopB,
      owned.id,
      "Hijacked",
    );
    assert.equal(renamed.ok, false);

    const deleted = await deleteSavedComparisonForShop(
      harness.prisma,
      shopB,
      owned.id,
    );
    assert.equal(deleted.ok, false);

    const stillThere = await getSavedComparisonForShop(
      harness.prisma,
      shopA,
      owned.id,
    );
    assert.equal(stillThere?.name, "Summer Promotion");
    assert.equal(harness.savedComparisons.length, 1);
  });

  it("opening a saved comparison does not create a new SavedComparison record", async () => {
    const harness = createSavedComparisonHarness(seededCatalog());
    const owned = await createSavedComparisonRecord(
      harness.prisma,
      shopA,
      "Summer Promotion",
      [{ trackedProductId: "tp_shirt", shopifyVariantId: "var_black" }],
    );
    const before = harness.savedComparisons.length;

    const opened = await getSavedComparisonForShop(
      harness.prisma,
      shopA,
      owned.id,
    );

    assert.equal(opened?.id, owned.id);
    assert.equal(harness.savedComparisons.length, before);
    assert.equal(harness.createCalls, 1);
  });

  it("rename changes only the name", async () => {
    const harness = createSavedComparisonHarness(seededCatalog());
    const owned = await createSavedComparisonRecord(
      harness.prisma,
      shopA,
      "Summer Promotion",
      [
        { trackedProductId: "tp_shirt", shopifyVariantId: "var_black" },
        { trackedProductId: "tp_bottle", shopifyVariantId: "var_500ml" },
      ],
    );
    const itemsBefore = harness.savedComparisonItems.map((item) => ({
      ...item,
    }));

    const renamed = await renameSavedComparisonForShop(
      harness.prisma,
      shopA,
      owned.id,
      "  Black Friday  ",
    );

    assert.deepEqual(renamed, { ok: true });
    assert.equal(harness.savedComparisons[0].name, "Black Friday");
    assert.deepEqual(
      harness.savedComparisonItems.map((item) => ({
        trackedProductId: item.trackedProductId,
        shopifyVariantId: item.shopifyVariantId,
        position: item.position,
      })),
      itemsBefore.map((item) => ({
        trackedProductId: item.trackedProductId,
        shopifyVariantId: item.shopifyVariantId,
        position: item.position,
      })),
    );
  });

  it("delete removes the group and items but not TrackedProducts", async () => {
    const harness = createSavedComparisonHarness(seededCatalog());
    const owned = await createSavedComparisonRecord(
      harness.prisma,
      shopA,
      "Summer Promotion",
      [
        { trackedProductId: "tp_shirt", shopifyVariantId: "var_black" },
        { trackedProductId: "tp_bottle", shopifyVariantId: "var_500ml" },
      ],
    );
    const trackedBefore = harness.trackedProducts.map((row) => row.id);

    const deleted = await deleteSavedComparisonForShop(
      harness.prisma,
      shopA,
      owned.id,
    );

    assert.deepEqual(deleted, { ok: true });
    assert.deepEqual(harness.savedComparisons, []);
    assert.deepEqual(harness.savedComparisonItems, []);
    assert.deepEqual(
      harness.trackedProducts.map((row) => row.id),
      trackedBefore,
    );
  });

  it("allows two named groups with the same products", async () => {
    const harness = createSavedComparisonHarness(seededCatalog());
    const items: SavedComparisonItemInput[] = [
      { trackedProductId: "tp_shirt", shopifyVariantId: "var_black" },
    ];

    await createSavedComparisonRecord(
      harness.prisma,
      shopA,
      "Summer Promotion",
      items,
    );
    await createSavedComparisonRecord(harness.prisma, shopA, "Black Friday", items);

    const listed = await listSavedComparisonsForShop(harness.prisma, shopA);
    assert.deepEqual(
      listed.map((row) => row.name).sort(),
      ["Black Friday", "Summer Promotion"],
    );
  });
});

describe("buildSavedComparisonItemsFromSnapshots", () => {
  it("captures currently selected variants for participating products", () => {
    assert.deepEqual(
      buildSavedComparisonItemsFromSnapshots([
        { trackedProductId: "tp_a", shopifyVariantId: "var_black" },
        { trackedProductId: "tp_b", shopifyVariantId: "var_default" },
        { trackedProductId: "tp_c", shopifyVariantId: null },
      ]),
      [
        { trackedProductId: "tp_a", shopifyVariantId: "var_black" },
        { trackedProductId: "tp_b", shopifyVariantId: "var_default" },
      ],
    );
  });
});

describe("normalizeSavedComparisonItems", () => {
  it("rejects duplicate tracked product entries", () => {
    const result = normalizeSavedComparisonItems([
      { trackedProductId: "tp_1", shopifyVariantId: "var_a" },
      { trackedProductId: "tp_1", shopifyVariantId: "var_b" },
    ]);
    assert.equal(result.ok, false);
  });
});

type TrackedProductRow = {
  id: string;
  shopId: string;
  shopifyProductId: string;
};

type SavedComparisonRow = {
  id: string;
  shop: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

type SavedComparisonItemRow = {
  id: string;
  savedComparisonId: string;
  trackedProductId: string;
  shopifyVariantId: string;
  position: number;
};

function seededCatalog() {
  return {
    trackedProducts: [
      {
        id: "tp_shirt",
        shopId: shopA,
        shopifyProductId: "gid://shopify/Product/1",
      },
      {
        id: "tp_bottle",
        shopId: shopA,
        shopifyProductId: "gid://shopify/Product/2",
      },
      {
        id: "tp_foreign",
        shopId: shopB,
        shopifyProductId: "gid://shopify/Product/9",
      },
    ] satisfies TrackedProductRow[],
    savedComparisons: [] as SavedComparisonRow[],
    savedComparisonItems: [] as SavedComparisonItemRow[],
  };
}

function createSavedComparisonHarness(initial: {
  trackedProducts: TrackedProductRow[];
  savedComparisons: SavedComparisonRow[];
  savedComparisonItems: SavedComparisonItemRow[];
}) {
  const trackedProducts = initial.trackedProducts.map((row) => ({ ...row }));
  let savedComparisons = initial.savedComparisons.map((row) => ({ ...row }));
  let savedComparisonItems = initial.savedComparisonItems.map((row) => ({
    ...row,
  }));
  let nextId = 1;
  let createCalls = 0;

  function matchingItems(savedComparisonId: string) {
    return savedComparisonItems
      .filter((item) => item.savedComparisonId === savedComparisonId)
      .sort((left, right) => left.position - right.position);
  }

  const prisma = {
    savedComparison: {
      findMany: async (args: {
        where: { shop: string };
        orderBy: { updatedAt: "desc" };
        include: { _count: { select: { items: true } } };
      }) => {
        return savedComparisons
          .filter((row) => row.shop === args.where.shop)
          .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
          .map((row) => ({
            ...row,
            _count: { items: matchingItems(row.id).length },
          }));
      },
      findFirst: async (args: {
        where: { id: string; shop: string };
        include: { items: { orderBy: { position: "asc" } } };
      }) => {
        const row = savedComparisons.find(
          (item) => item.id === args.where.id && item.shop === args.where.shop,
        );
        if (!row) {
          return null;
        }
        return { ...row, items: matchingItems(row.id) };
      },
      create: async (args: {
        data: {
          shop: string;
          name: string;
          items: {
            create: Array<{
              trackedProductId: string;
              shopifyVariantId: string;
              position: number;
            }>;
          };
        };
        include: { items: { orderBy: { position: "asc" } } };
      }) => {
        createCalls += 1;
        const id = `sc_${nextId++}`;
        const now = new Date();
        const row: SavedComparisonRow = {
          id,
          shop: args.data.shop,
          name: args.data.name,
          createdAt: now,
          updatedAt: now,
        };
        savedComparisons = [...savedComparisons, row];
        const createdItems = args.data.items.create.map((item) => {
          const duplicate = savedComparisonItems.some(
            (existing) =>
              existing.savedComparisonId === id &&
              existing.trackedProductId === item.trackedProductId,
          );
          if (duplicate) {
            throw new Error("duplicate tracked product in saved comparison");
          }
          return {
            id: `sci_${nextId++}`,
            savedComparisonId: id,
            trackedProductId: item.trackedProductId,
            shopifyVariantId: item.shopifyVariantId,
            position: item.position,
          };
        });
        savedComparisonItems = [...savedComparisonItems, ...createdItems];
        return { ...row, items: matchingItems(id) };
      },
      updateMany: async (args: {
        where: { id: string; shop: string };
        data: { name: string };
      }) => {
        let count = 0;
        savedComparisons = savedComparisons.map((row) => {
          if (row.id !== args.where.id || row.shop !== args.where.shop) {
            return row;
          }
          count += 1;
          return { ...row, name: args.data.name, updatedAt: new Date() };
        });
        return { count };
      },
      deleteMany: async (args: { where: { id: string; shop: string } }) => {
        const toDelete = savedComparisons.filter(
          (row) => row.id === args.where.id && row.shop === args.where.shop,
        );
        if (toDelete.length === 0) {
          return { count: 0 };
        }
        const ids = new Set(toDelete.map((row) => row.id));
        savedComparisons = savedComparisons.filter((row) => !ids.has(row.id));
        savedComparisonItems = savedComparisonItems.filter(
          (item) => !ids.has(item.savedComparisonId),
        );
        return { count: toDelete.length };
      },
    },
  } as unknown as PrismaClient;

  return {
    prisma,
    get trackedProducts() {
      return trackedProducts;
    },
    get savedComparisons() {
      return savedComparisons;
    },
    get savedComparisonItems() {
      return savedComparisonItems;
    },
    get createCalls() {
      return createCalls;
    },
  };
}

function comparisonProducts(): {
  shirt: ComparisonProduct;
  bottle: ComparisonProduct;
} {
  const shirt = buildComparisonProduct({
    trackedProductId: "tp_shirt",
    title: "Classic T-Shirt",
    imageUrl: null,
    imageAlt: null,
    currency: "USD",
    variants: [
      {
        id: "var_black",
        title: "Black / Medium",
        price: "50.00",
        unitCost: "24.00",
      },
      {
        id: "var_red",
        title: "Red / Large",
        price: "55.00",
        unitCost: "24.00",
      },
    ],
    profiles: [
      costProfile({ shopifyVariantId: "var_black", totalCost: "24.00" }),
      costProfile({ shopifyVariantId: "var_red", totalCost: "24.00" }),
    ],
    selectedShopifyVariantId: "var_red",
  });
  const bottle = buildComparisonProduct({
    trackedProductId: "tp_bottle",
    title: "Water Bottle",
    imageUrl: null,
    imageAlt: null,
    currency: "USD",
    variants: [
      {
        id: "var_500ml",
        title: "500ml",
        price: "18.00",
        unitCost: "6.00",
      },
    ],
    profiles: [costProfile({ shopifyVariantId: "var_500ml", totalCost: "6.00" })],
    selectedShopifyVariantId: null,
  });

  return { shirt, bottle };
}

function multiVariantShoes(): ComparisonProduct {
  return buildComparisonProduct({
    trackedProductId: "tp_shoes",
    title: "Running Shoes",
    imageUrl: null,
    imageAlt: null,
    currency: "USD",
    variants: [
      {
        id: "var_black",
        title: "Black / Medium",
        price: "50.00",
        unitCost: "24.00",
      },
      {
        id: "var_blue",
        title: "Blue / Large",
        price: "90.00",
        unitCost: "52.00",
      },
    ],
    profiles: [
      costProfile({ shopifyVariantId: "var_black", totalCost: "24.00" }),
      costProfile({ shopifyVariantId: "var_blue", totalCost: "52.00" }),
    ],
    selectedShopifyVariantId: "var_black",
  });
}

function costProfile(input: {
  shopifyVariantId: string;
  totalCost: string | null;
  sellingPrice?: string | null;
}): CostProfile {
  return {
    id: `cp_${input.shopifyVariantId || "product"}`,
    shop: shopA,
    productId: "gid://shopify/Product/1",
    shopifyVariantId: input.shopifyVariantId,
    currency: "USD",
    mode: "QUICK_START",
    totalCost: input.totalCost,
    sellingPrice: input.sellingPrice ?? null,
    notes: null,
    items: [],
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}
