import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";

import { entitlementForTier } from "./planEntitlements.server";
import { stopTrackingProduct } from "./stopTrackingProduct.server";
import { createPrismaTrackedProductRepository } from "../modules/products/repositories/prismaTrackedProductRepository";

type CostProfileRow = {
  id: string;
  shop: string;
  productId: string;
};

type TrackedProductRow = {
  shopId: string;
  shopifyProductId: string;
};

type StopHarnessOptions = {
  failTrackedDelete?: boolean;
};

/**
 * In-memory Prisma stand-in that supports interactive `$transaction`.
 * Mutations applied on the transaction client are discarded when the
 * callback throws — modeling real transactional rollback.
 */
function createStopTrackingHarness(
  initial: {
    costProfiles: CostProfileRow[];
    trackedProducts: TrackedProductRow[];
  },
  options: StopHarnessOptions = {},
) {
  let costProfiles = initial.costProfiles.map((row) => ({ ...row }));
  let trackedProducts = initial.trackedProducts.map((row) => ({ ...row }));
  let transactionCalls = 0;

  function createClient(working: {
    costProfiles: CostProfileRow[];
    trackedProducts: TrackedProductRow[];
  }) {
    return {
      costProfile: {
        deleteMany: async (args: {
          where: { shop: string; productId: string };
        }) => {
          const before = working.costProfiles.length;
          working.costProfiles = working.costProfiles.filter(
            (row) =>
              !(
                row.shop === args.where.shop &&
                row.productId === args.where.productId
              ),
          );
          return { count: before - working.costProfiles.length };
        },
      },
      trackedProduct: {
        findMany: async (args: {
          where: { shopId: string; shopifyProductId?: { in: string[] } };
        }) => {
          return working.trackedProducts
            .filter((row) => {
              if (row.shopId !== args.where.shopId) {
                return false;
              }
              if (args.where.shopifyProductId?.in) {
                return args.where.shopifyProductId.in.includes(
                  row.shopifyProductId,
                );
              }
              return true;
            })
            .map((row) => ({ shopifyProductId: row.shopifyProductId }));
        },
        count: async (args: { where: { shopId: string } }) =>
          working.trackedProducts.filter(
            (row) => row.shopId === args.where.shopId,
          ).length,
        createMany: async (args: {
          data: Array<{ shopId: string; shopifyProductId: string }>;
        }) => {
          let count = 0;
          for (const row of args.data) {
            const exists = working.trackedProducts.some(
              (existing) =>
                existing.shopId === row.shopId &&
                existing.shopifyProductId === row.shopifyProductId,
            );
            if (!exists) {
              working.trackedProducts.push({ ...row });
              count += 1;
            }
          }
          return { count };
        },
        deleteMany: async (args: {
          where: { shopId: string; shopifyProductId: string };
        }) => {
          if (options.failTrackedDelete) {
            throw new Error("simulated trackedProduct.deleteMany failure");
          }
          const before = working.trackedProducts.length;
          working.trackedProducts = working.trackedProducts.filter(
            (row) =>
              !(
                row.shopId === args.where.shopId &&
                row.shopifyProductId === args.where.shopifyProductId
              ),
          );
          return { count: before - working.trackedProducts.length };
        },
      },
    };
  }

  const prisma = {
    ...createClient({
      get costProfiles() {
        return costProfiles;
      },
      set costProfiles(next: CostProfileRow[]) {
        costProfiles = next;
      },
      get trackedProducts() {
        return trackedProducts;
      },
      set trackedProducts(next: TrackedProductRow[]) {
        trackedProducts = next;
      },
    }),
    $transaction: async <T>(
      operation: (tx: ReturnType<typeof createClient>) => Promise<T>,
    ): Promise<T> => {
      transactionCalls += 1;
      const snapshot = {
        costProfiles: costProfiles.map((row) => ({ ...row })),
        trackedProducts: trackedProducts.map((row) => ({ ...row })),
      };
      const tx = createClient(snapshot);
      const result = await operation(tx);
      // Commit only after the callback succeeds; a throw leaves outer state unchanged.
      costProfiles = snapshot.costProfiles;
      trackedProducts = snapshot.trackedProducts;
      return result;
    },
  } as unknown as PrismaClient;

  return {
    prisma,
    get costProfiles() {
      return costProfiles;
    },
    get trackedProducts() {
      return trackedProducts;
    },
    get transactionCalls() {
      return transactionCalls;
    },
  };
}

describe("stopTrackingProduct", () => {
  const shopA = "shop-a.myshopify.com";
  const shopB = "shop-b.myshopify.com";
  const productA = "gid://shopify/Product/1";
  const productB = "gid://shopify/Product/2";
  const productC = "gid://shopify/Product/3";

  it("normal stop deletes CostProfiles and TrackedProduct for the shop/product", async () => {
    const harness = createStopTrackingHarness({
      costProfiles: [
        { id: "cp-1", shop: shopA, productId: productA },
        { id: "cp-1b", shop: shopA, productId: productA },
        { id: "cp-2", shop: shopA, productId: productB },
        { id: "cp-other", shop: shopB, productId: productA },
      ],
      trackedProducts: [
        { shopId: shopA, shopifyProductId: productA },
        { shopId: shopA, shopifyProductId: productB },
        { shopId: shopB, shopifyProductId: productA },
      ],
    });

    await stopTrackingProduct(harness.prisma, shopA, productA);

    assert.equal(harness.transactionCalls, 1);
    assert.deepEqual(harness.costProfiles.map((row) => row.id).sort(), [
      "cp-2",
      "cp-other",
    ]);
    assert.deepEqual(harness.trackedProducts, [
      { shopId: shopA, shopifyProductId: productB },
      { shopId: shopB, shopifyProductId: productA },
    ]);
  });

  it("cannot affect another shop's records", async () => {
    const harness = createStopTrackingHarness({
      costProfiles: [
        { id: "cp-a", shop: shopA, productId: productA },
        { id: "cp-b", shop: shopB, productId: productA },
      ],
      trackedProducts: [
        { shopId: shopA, shopifyProductId: productA },
        { shopId: shopB, shopifyProductId: productA },
      ],
    });

    await stopTrackingProduct(harness.prisma, shopA, productA);

    assert.deepEqual(harness.costProfiles, [
      { id: "cp-b", shop: shopB, productId: productA },
    ]);
    assert.deepEqual(harness.trackedProducts, [
      { shopId: shopB, shopifyProductId: productA },
    ]);
  });

  it("leaves unrelated tracked products for the same shop", async () => {
    const harness = createStopTrackingHarness({
      costProfiles: [
        { id: "cp-a", shop: shopA, productId: productA },
        { id: "cp-c", shop: shopA, productId: productC },
      ],
      trackedProducts: [
        { shopId: shopA, shopifyProductId: productA },
        { shopId: shopA, shopifyProductId: productC },
      ],
    });

    await stopTrackingProduct(harness.prisma, shopA, productA);

    assert.deepEqual(harness.trackedProducts, [
      { shopId: shopA, shopifyProductId: productC },
    ]);
    assert.deepEqual(harness.costProfiles, [
      { id: "cp-c", shop: shopA, productId: productC },
    ]);
  });

  it("repeated stop is a safe no-op", async () => {
    const harness = createStopTrackingHarness({
      costProfiles: [{ id: "cp-a", shop: shopA, productId: productA }],
      trackedProducts: [{ shopId: shopA, shopifyProductId: productA }],
    });

    await stopTrackingProduct(harness.prisma, shopA, productA);
    await stopTrackingProduct(harness.prisma, shopA, productA);

    assert.equal(harness.transactionCalls, 2);
    assert.deepEqual(harness.costProfiles, []);
    assert.deepEqual(harness.trackedProducts, []);
  });

  it("rolls back CostProfile deletion when TrackedProduct deletion fails", async () => {
    const harness = createStopTrackingHarness(
      {
        costProfiles: [
          { id: "cp-a", shop: shopA, productId: productA },
          { id: "cp-b", shop: shopA, productId: productB },
        ],
        trackedProducts: [
          { shopId: shopA, shopifyProductId: productA },
          { shopId: shopA, shopifyProductId: productB },
        ],
      },
      { failTrackedDelete: true },
    );

    await assert.rejects(
      stopTrackingProduct(harness.prisma, shopA, productA),
      /simulated trackedProduct\.deleteMany failure/,
    );

    assert.equal(harness.transactionCalls, 1);
    assert.deepEqual(harness.costProfiles.map((row) => row.id).sort(), [
      "cp-a",
      "cp-b",
    ]);
    assert.deepEqual(harness.trackedProducts, [
      { shopId: shopA, shopifyProductId: productA },
      { shopId: shopA, shopifyProductId: productB },
    ]);
  });

  it("decreases usage count by exactly one", async () => {
    const products = Array.from(
      { length: 50 },
      (_, index) => `gid://shopify/Product/${index}`,
    );
    const harness = createStopTrackingHarness({
      costProfiles: products.map((productId, index) => ({
        id: `cp-${index}`,
        shop: shopA,
        productId,
      })),
      trackedProducts: products.map((shopifyProductId) => ({
        shopId: shopA,
        shopifyProductId,
      })),
    });

    assert.equal(harness.trackedProducts.length, 50);
    await stopTrackingProduct(harness.prisma, shopA, products[0]);
    assert.equal(harness.trackedProducts.length, 49);
  });

  it("frees one Starter slot so a new product can be added", async () => {
    const starter = entitlementForTier("starter");
    const products = Array.from(
      { length: 50 },
      (_, index) => `existing-${index}`,
    );
    const harness = createStopTrackingHarness({
      costProfiles: products.map((productId, index) => ({
        id: `cp-${index}`,
        shop: shopA,
        productId,
      })),
      trackedProducts: products.map((shopifyProductId) => ({
        shopId: shopA,
        shopifyProductId,
      })),
    });
    const repository = createPrismaTrackedProductRepository(harness.prisma);

    await stopTrackingProduct(harness.prisma, shopA, products[0]);
    assert.equal(harness.trackedProducts.length, 49);

    const inserted = await repository.trackProducts(shopA, ["new-product"], {
      maxTrackedProducts: starter.trackedProductLimit,
      entitlement: starter,
    });

    assert.equal(inserted, 1);
    assert.equal(harness.trackedProducts.length, 50);
  });

  it("downgrade over-limit: stopping one leaves 199 and still blocks adds until 149", async () => {
    const growth = entitlementForTier("growth");
    const limit = growth.trackedProductLimit!;
    const products = Array.from(
      { length: 200 },
      (_, index) => `existing-${index}`,
    );
    const harness = createStopTrackingHarness({
      costProfiles: products.map((productId, index) => ({
        id: `cp-${index}`,
        shop: shopA,
        productId,
      })),
      trackedProducts: products.map((shopifyProductId) => ({
        shopId: shopA,
        shopifyProductId,
      })),
    });
    const repository = createPrismaTrackedProductRepository(harness.prisma);

    await stopTrackingProduct(harness.prisma, shopA, products[0]);
    assert.equal(harness.trackedProducts.length, 199);

    await assert.rejects(
      repository.trackProducts(shopA, ["blocked-product"], {
        maxTrackedProducts: limit,
        entitlement: growth,
      }),
      /Growth plan allows up to 150 tracked products/,
    );

    // Stop until usage is limit - 1 (149).
    for (const productId of products.slice(1, 201 - limit)) {
      await stopTrackingProduct(harness.prisma, shopA, productId);
    }
    assert.equal(harness.trackedProducts.length, limit - 1);

    const inserted = await repository.trackProducts(
      shopA,
      ["allowed-product"],
      {
        maxTrackedProducts: limit,
        entitlement: growth,
      },
    );
    assert.equal(inserted, 1);
    assert.equal(harness.trackedProducts.length, limit);
  });
});
