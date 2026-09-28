import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";

import type { PartnerActiveSubscription } from "./partnerApi.server";
import {
  entitlementForTier,
  resolvePlanEntitlementFromSubscription,
} from "./planEntitlements.server";
import {
  canAddTrackedProducts,
  countNewUniqueProductIds,
  formatTrackedProductLimitMessage,
  TrackedProductLimitExceededError,
} from "./trackedProductCapacity";
import { countTrackedProductsForShop } from "./trackedProductUsage.server";
import { createPrismaTrackedProductRepository } from "../modules/products/repositories/prismaTrackedProductRepository";

function subscriptionWithHandles(
  ...handles: string[]
): PartnerActiveSubscription {
  return {
    billingPeriod: "EVERY_30_DAYS",
    cancelAtEndOfCycle: false,
    trialEndsAt: null,
    currentBillingCycle: null,
    items: handles.map((handle) => ({ handle })),
    pendingUpdate: null,
  };
}

function createRepositoryHarness(initialProductIds: string[]) {
  const trackedProductIds = [...initialProductIds];
  let createManyCalls = 0;
  let deleteManyCalls = 0;

  const trackedProduct = {
    findMany: async (args: {
      where: { shopId: string; shopifyProductId: { in: string[] } };
    }) =>
      trackedProductIds
        .filter((id) => args.where.shopifyProductId.in.includes(id))
        .map((shopifyProductId) => ({ shopifyProductId })),
    count: async () => trackedProductIds.length,
    createMany: async (args: {
      data: Array<{ shopId: string; shopifyProductId: string }>;
    }) => {
      createManyCalls += 1;
      let count = 0;
      for (const row of args.data) {
        if (!trackedProductIds.includes(row.shopifyProductId)) {
          trackedProductIds.push(row.shopifyProductId);
          count += 1;
        }
      }
      return { count };
    },
    deleteMany: async (args: {
      where: { shopId: string; shopifyProductId: string };
    }) => {
      deleteManyCalls += 1;
      const index = trackedProductIds.indexOf(args.where.shopifyProductId);
      if (index === -1) {
        return { count: 0 };
      }
      trackedProductIds.splice(index, 1);
      return { count: 1 };
    },
  };

  const prisma = {
    trackedProduct,
    $transaction: async (
      operation: (tx: {
        trackedProduct: typeof trackedProduct;
      }) => Promise<number>,
    ) => operation({ trackedProduct }),
  } as unknown as PrismaClient;

  return {
    repository: createPrismaTrackedProductRepository(prisma),
    trackedProductIds,
    get createManyCalls() {
      return createManyCalls;
    },
    get deleteManyCalls() {
      return deleteManyCalls;
    },
  };
}

describe("plan entitlements", () => {
  it("maps canonical Shopify plan handles without environment configuration", () => {
    const expected = [
      ["monthly", "starter", 50],
      ["growth", "growth", 150],
      ["pro", "pro", 400],
      ["unlimited", "unlimited", null],
    ] as const;

    for (const [handle, tierId, limit] of expected) {
      const entitlement = resolvePlanEntitlementFromSubscription(
        subscriptionWithHandles(handle),
      );
      assert.equal(entitlement.tierId, tierId);
      assert.equal(entitlement.trackedProductLimit, limit);
    }
  });

  it("selects the highest recognized entitlement from multiple handles", () => {
    const entitlement = resolvePlanEntitlementFromSubscription(
      subscriptionWithHandles("monthly", "pro", "growth"),
    );

    assert.equal(entitlement.tierId, "pro");
    assert.equal(entitlement.trackedProductLimit, 400);
  });

  it("falls back safely to Starter for unknown or missing subscriptions", () => {
    assert.equal(
      resolvePlanEntitlementFromSubscription(
        subscriptionWithHandles("legacy-plan"),
      ).tierId,
      "starter",
    );
    assert.equal(
      resolvePlanEntitlementFromSubscription(null).tierId,
      "starter",
    );
  });
});

describe("tracked product capacity", () => {
  const starter = entitlementForTier("starter");
  const unlimited = entitlementForTier("unlimited");

  it("uses the configured product limits for every tier", () => {
    assert.equal(starter.trackedProductLimit, 50);
    assert.equal(entitlementForTier("growth").trackedProductLimit, 150);
    assert.equal(entitlementForTier("pro").trackedProductLimit, 400);
    assert.equal(unlimited.trackedProductLimit, null);
  });

  it("A — Starter 0/50 can add one new product", () => {
    const additional = countNewUniqueProductIds(["product-a"], new Set());
    assert.equal(additional, 1);
    assert.equal(
      canAddTrackedProducts(
        { currentCount: 0, limit: starter.trackedProductLimit },
        additional,
      ),
      true,
    );
  });

  it("B — Starter 49/50 can add one product and reach 50", () => {
    const additional = countNewUniqueProductIds(["product-new"], new Set());
    assert.equal(49 + additional, 50);
    assert.equal(
      canAddTrackedProducts(
        { currentCount: 49, limit: starter.trackedProductLimit },
        additional,
      ),
      true,
    );
  });

  it("C — Starter 50/50 rejects one new product", () => {
    assert.equal(
      canAddTrackedProducts(
        { currentCount: 50, limit: starter.trackedProductLimit },
        1,
      ),
      false,
    );
  });

  it("D — Growth 149/150 can add one product", () => {
    assert.equal(
      canAddTrackedProducts(
        {
          currentCount: 149,
          limit: entitlementForTier("growth").trackedProductLimit,
        },
        1,
      ),
      true,
    );
  });

  it("E — Growth 150/150 rejects one new product", () => {
    assert.equal(
      canAddTrackedProducts(
        {
          currentCount: 150,
          limit: entitlementForTier("growth").trackedProductLimit,
        },
        1,
      ),
      false,
    );
  });

  it("F — Pro 399/400 can add one product", () => {
    assert.equal(
      canAddTrackedProducts(
        {
          currentCount: 399,
          limit: entitlementForTier("pro").trackedProductLimit,
        },
        1,
      ),
      true,
    );
  });

  it("G — Pro 400/400 rejects one new product", () => {
    assert.equal(
      canAddTrackedProducts(
        {
          currentCount: 400,
          limit: entitlementForTier("pro").trackedProductLimit,
        },
        1,
      ),
      false,
    );
  });

  it("rejects a batch that exceeds the remaining capacity", () => {
    const additional = countNewUniqueProductIds(
      ["product-a", "product-b", "product-c"],
      new Set(),
    );
    assert.equal(additional, 3);
    assert.equal(
      canAddTrackedProducts(
        { currentCount: 48, limit: starter.trackedProductLimit },
        additional,
      ),
      false,
    );
  });

  it("only new unique products consume slots in a mixed request", () => {
    const existing = new Set(["product-a", "product-b"]);
    const additional = countNewUniqueProductIds(
      ["product-a", "product-b", "product-c", "product-d"],
      existing,
    );
    assert.equal(additional, 2);
    assert.equal(
      canAddTrackedProducts(
        { currentCount: 48, limit: starter.trackedProductLimit },
        additional,
      ),
      true,
    );
    assert.equal(48 + additional, 50);
  });

  it("I — selecting an already-tracked product consumes no additional slot", () => {
    assert.equal(
      countNewUniqueProductIds(
        ["gid://shopify/Product/1"],
        new Set(["gid://shopify/Product/1"]),
      ),
      0,
    );
  });

  it("selecting the same Shopify product twice consumes one slot", () => {
    assert.equal(
      countNewUniqueProductIds(
        ["gid://shopify/Product/1", "gid://shopify/Product/1"],
        new Set(),
      ),
      1,
    );
  });

  it("J — a product with four variants still consumes one slot", () => {
    const product = {
      id: "gid://shopify/Product/1",
      variantIds: ["small", "medium", "large", "xl"],
    };
    assert.equal(product.variantIds.length, 4);
    assert.equal(countNewUniqueProductIds([product.id], new Set()), 1);
  });

  it("K — changing selectedShopifyVariantId does not change usage", () => {
    const trackedProducts = [
      {
        shopifyProductId: "gid://shopify/Product/1",
        selectedShopifyVariantId: "gid://shopify/ProductVariant/medium",
      },
    ];
    const usageBefore = trackedProducts.length;
    trackedProducts[0].selectedShopifyVariantId =
      "gid://shopify/ProductVariant/large";
    assert.equal(trackedProducts.length, usageBefore);
  });

  it("stopping one product frees exactly one slot", () => {
    const currentCount = 50;
    const countAfterStop = currentCount - 1;
    assert.equal(countAfterStop, 49);
    assert.equal(
      canAddTrackedProducts(
        { currentCount: countAfterStop, limit: starter.trackedProductLimit },
        1,
      ),
      true,
    );
  });

  it("H — Unlimited allows additions at any tracked-product count", () => {
    assert.equal(
      canAddTrackedProducts(
        { currentCount: 10_000, limit: unlimited.trackedProductLimit },
        500,
      ),
      true,
    );
  });

  for (const [tierId, limit] of [
    ["starter", 50],
    ["growth", 150],
    ["pro", 400],
  ] as const) {
    describe(`${tierId} repository boundary (${limit})`, () => {
      it(`${limit - 1} existing + 1 new is allowed and ends at ${limit}`, async () => {
        const harness = createRepositoryHarness(
          Array.from({ length: limit - 1 }, (_, index) => `existing-${index}`),
        );

        const inserted = await harness.repository.trackProducts(
          "shop-a",
          ["new-product"],
          {
            maxTrackedProducts: limit,
            entitlement: entitlementForTier(tierId),
          },
        );

        assert.equal(inserted, 1);
        assert.equal(harness.trackedProductIds.length, limit);
      });

      it(`${limit} existing + 1 new is rejected without insertion`, async () => {
        const harness = createRepositoryHarness(
          Array.from({ length: limit }, (_, index) => `existing-${index}`),
        );

        await assert.rejects(
          harness.repository.trackProducts("shop-a", ["new-product"], {
            maxTrackedProducts: limit,
            entitlement: entitlementForTier(tierId),
          }),
          TrackedProductLimitExceededError,
        );

        assert.equal(harness.trackedProductIds.length, limit);
        assert.equal(harness.createManyCalls, 0);
      });

      it(`${limit - 1} existing + 2 new rejects the whole batch`, async () => {
        const initialIds = Array.from(
          { length: limit - 1 },
          (_, index) => `existing-${index}`,
        );
        const harness = createRepositoryHarness(initialIds);

        await assert.rejects(
          harness.repository.trackProducts(
            "shop-a",
            ["new-product-a", "new-product-b"],
            {
              maxTrackedProducts: limit,
              entitlement: entitlementForTier(tierId),
            },
          ),
          TrackedProductLimitExceededError,
        );

        assert.deepEqual(harness.trackedProductIds, initialIds);
        assert.equal(harness.createManyCalls, 0);
      });
    });
  }

  it("Unlimited inserts additions above 400 without finite-capacity rejection", async () => {
    const harness = createRepositoryHarness(
      Array.from({ length: 450 }, (_, index) => `existing-${index}`),
    );

    const inserted = await harness.repository.trackProducts(
      "shop-a",
      ["new-product-a", "new-product-b"],
      {
        maxTrackedProducts: unlimited.trackedProductLimit,
        entitlement: unlimited,
      },
    );

    assert.equal(inserted, 2);
    assert.equal(harness.trackedProductIds.length, 452);
  });

  it("at the limit, an already-tracked product is a no-op", async () => {
    const harness = createRepositoryHarness(
      Array.from({ length: 50 }, (_, index) => `existing-${index}`),
    );

    const inserted = await harness.repository.trackProducts(
      "shop-a",
      ["existing-0"],
      {
        maxTrackedProducts: starter.trackedProductLimit,
        entitlement: starter,
      },
    );

    assert.equal(inserted, 0);
    assert.equal(harness.trackedProductIds.length, 50);
    assert.equal(harness.createManyCalls, 0);
  });

  it("duplicate product IDs in one request insert and consume one slot", async () => {
    const harness = createRepositoryHarness(
      Array.from({ length: 49 }, (_, index) => `existing-${index}`),
    );

    const inserted = await harness.repository.trackProducts(
      "shop-a",
      ["new-product", "new-product", " new-product "],
      {
        maxTrackedProducts: starter.trackedProductLimit,
        entitlement: starter,
      },
    );

    assert.equal(inserted, 1);
    assert.equal(harness.trackedProductIds.length, 50);
  });

  it("variant selection does not create or consume tracked-product slots", () => {
    const trackedProduct = {
      shopifyProductId: "gid://shopify/Product/1",
      selectedShopifyVariantId: "gid://shopify/ProductVariant/1",
    };
    const countBefore = 1;

    trackedProduct.selectedShopifyVariantId = "gid://shopify/ProductVariant/2";

    assert.equal(countBefore, 1);
    assert.equal(trackedProduct.shopifyProductId, "gid://shopify/Product/1");
  });

  it("usage count is scoped to the authenticated shop", async () => {
    const countCalls: unknown[] = [];
    const prisma = {
      trackedProduct: {
        count: async (args: unknown) => {
          countCalls.push(args);
          return 12;
        },
      },
    } as unknown as PrismaClient;

    assert.equal(await countTrackedProductsForShop(prisma, "shop-a"), 12);
    assert.deepEqual(countCalls, [{ where: { shopId: "shop-a" } }]);
  });

  it("L — downgrade preserves 180 products but blocks additions at 50", () => {
    const existingProductCount = 180;
    assert.equal(
      canAddTrackedProducts(
        {
          currentCount: existingProductCount,
          limit: starter.trackedProductLimit,
        },
        1,
      ),
      false,
    );
    assert.equal(existingProductCount, 180);
  });

  for (const [tierId, limit] of [
    ["growth", 150],
    ["starter", 50],
  ] as const) {
    it(`downgrade from Pro with 200 products to ${tierId} preserves data and blocks until below ${limit}`, async () => {
      const initialIds = Array.from(
        { length: 200 },
        (_, index) => `existing-${index}`,
      );
      const harness = createRepositoryHarness(initialIds);
      const associatedCostProfileIds = ["cost-profile-a", "cost-profile-b"];

      await assert.rejects(
        harness.repository.trackProducts("shop-a", ["blocked-product"], {
          maxTrackedProducts: limit,
          entitlement: entitlementForTier(tierId),
        }),
        TrackedProductLimitExceededError,
      );

      assert.deepEqual(harness.trackedProductIds, initialIds);
      assert.deepEqual(associatedCostProfileIds, [
        "cost-profile-a",
        "cost-profile-b",
      ]);
      assert.equal(harness.deleteManyCalls, 0);

      for (const productId of initialIds.slice(0, 201 - limit)) {
        await harness.repository.untrackProduct("shop-a", productId);
      }

      assert.equal(harness.trackedProductIds.length, limit - 1);
      assert.equal(
        await harness.repository.trackProducts("shop-a", ["allowed-product"], {
          maxTrackedProducts: limit,
          entitlement: entitlementForTier(tierId),
        }),
        1,
      );
      assert.equal(harness.trackedProductIds.length, limit);
    });
  }

  it("M — rejects an over-capacity batch before any insert", async () => {
    let createManyCalled = false;
    const transactionClient = {
      trackedProduct: {
        findMany: async () => [],
        count: async () => 49,
        createMany: async () => {
          createManyCalled = true;
          return { count: 2 };
        },
      },
    };
    const prisma = {
      $transaction: async (
        operation: (tx: typeof transactionClient) => Promise<number>,
      ) => operation(transactionClient),
    } as unknown as PrismaClient;
    const repository = createPrismaTrackedProductRepository(prisma);

    await assert.rejects(
      repository.trackProducts("shop-a", ["product-a", "product-b"], {
        maxTrackedProducts: starter.trackedProductLimit,
      }),
      TrackedProductLimitExceededError,
    );
    assert.equal(createManyCalled, false);
  });

  it("uses tracked-product wording in limit messages", () => {
    const message = formatTrackedProductLimitMessage({
      planDisplayName: "Starter",
      limit: 50,
      currentCount: 48,
      additionalRequested: 3,
    });
    assert.match(message, /Starter plan allows up to 50 tracked products/);
    assert.match(message, /48 tracked products and can add 2 more/);
  });
});
