import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CostProfile } from "../modules/cost-profiles/types/CostProfile";
import {
  aggregateSharedStrategyValidation,
  buildComparisonProduct,
  computeCurrentProjectedOutcome,
  displayComparisonVariantTitle,
  formatComparisonReadinessSummary,
  formatComparisonStrategyColumnValue,
  formatCurrentComparisonMargin,
  listActiveComparisonStrategyColumns,
  resolveActiveComparisonSnapshot,
  resolveComparisonCurrentPrice,
  resolveDefaultComparisonVariantId,
  resolveEffectiveComparisonCost,
  resolveShopScopedTrackedProducts,
  simulateComparisonRow,
  summarizeComparisonReadiness,
  toComparisonSimulationBaseline,
  type ComparisonVariantSource,
} from "../modules/products/lib/compareScenarios";
import {
  compareScenariosHref,
  parseCompareScenarioIds,
} from "../modules/products/lib/productStatus";
import {
  EMPTY_STRATEGY_FIELDS,
  removeStrategy,
  simulateProjectedOutcome,
  type StrategyFieldMap,
  type StrategyInputs,
} from "../modules/products/lib/simulateProjectedOutcome";
import type { StrategyId } from "../modules/products/lib/strategyCatalog";
import { validateStrategyBusinessRules } from "../modules/products/lib/validateStrategyBusinessRules";

describe("compareScenariosHref", () => {
  it("omits the ids param when nothing is selected", () => {
    assert.equal(compareScenariosHref([]), "/app/products/compare");
    assert.equal(compareScenariosHref(["", "  "]), "/app/products/compare");
  });

  it("passes unique tracked-product IDs in the query string", () => {
    assert.equal(
      compareScenariosHref(["tp_1", "tp_2", "tp_1"]),
      "/app/products/compare?ids=tp_1%2Ctp_2",
    );
  });
});

describe("parseCompareScenarioIds", () => {
  it("reads unique tracked-product IDs from the query string", () => {
    assert.deepEqual(
      parseCompareScenarioIds(new URLSearchParams("ids=tp_1,tp_2,tp_1")),
      ["tp_1", "tp_2"],
    );
  });

  it("returns an empty list when ids are missing", () => {
    assert.deepEqual(parseCompareScenarioIds(new URLSearchParams()), []);
    assert.deepEqual(parseCompareScenarioIds(new URLSearchParams("ids=")), []);
  });
});

describe("resolveShopScopedTrackedProducts", () => {
  const shopA = [
    { id: "tp_1", shopId: "shop-a.myshopify.com", title: "Shirt" },
    { id: "tp_2", shopId: "shop-a.myshopify.com", title: "Shoes" },
    { id: "tp_3", shopId: "shop-a.myshopify.com", title: "Cap" },
  ];

  it("keeps only IDs that belong to the authenticated shop, in selection order", () => {
    const resolved = resolveShopScopedTrackedProducts(
      ["tp_3", "tp_1", "tp_foreign"],
      shopA,
    );

    assert.deepEqual(
      resolved.map((product) => product.id),
      ["tp_3", "tp_1"],
    );
  });

  it("cannot load a foreign-shop tracked product even if the ID is supplied", () => {
    const resolved = resolveShopScopedTrackedProducts(
      ["tp_foreign"],
      shopA,
    );

    assert.deepEqual(resolved, []);
  });

  it("drops invalid IDs without failing", () => {
    const resolved = resolveShopScopedTrackedProducts(
      ["", " missing ", "tp_2", "nope"],
      shopA,
    );

    assert.deepEqual(
      resolved.map((product) => product.id),
      ["tp_2"],
    );
  });

  it("resolves multiple selected products", () => {
    const resolved = resolveShopScopedTrackedProducts(
      ["tp_1", "tp_2", "tp_3"],
      shopA,
    );

    assert.deepEqual(
      resolved.map((product) => product.title),
      ["Shirt", "Shoes", "Cap"],
    );
  });
});

describe("resolveDefaultComparisonVariantId", () => {
  const variants: ComparisonVariantSource[] = [
    { id: "var_black", title: "Black / Medium", price: "50.00", unitCost: null },
    { id: "var_red", title: "Red / Large", price: "55.00", unitCost: null },
  ];

  it("uses the only variant automatically", () => {
    assert.equal(
      resolveDefaultComparisonVariantId(
        [variants[0]],
        [],
        null,
      ),
      "var_black",
    );
  });

  it("prefers the persisted selected variant when it still exists", () => {
    assert.equal(
      resolveDefaultComparisonVariantId(variants, [], "var_red"),
      "var_red",
    );
  });

  it("uses the sole ready variant when nothing is persisted", () => {
    assert.equal(
      resolveDefaultComparisonVariantId(
        variants,
        [costProfile({ shopifyVariantId: "var_red", totalCost: "20.00" })],
        null,
      ),
      "var_red",
    );
  });

  it("falls back to the first variant for multi-variant products", () => {
    assert.equal(
      resolveDefaultComparisonVariantId(variants, [], null),
      "var_black",
    );
  });
});

describe("resolveEffectiveComparisonCost", () => {
  it("uses the variant CostProfile when it is decision-ready", () => {
    assert.equal(
      resolveEffectiveComparisonCost(
        [costProfile({ shopifyVariantId: "var_black", totalCost: "24.00" })],
        "var_black",
        2,
      ),
      "24.00",
    );
  });

  it("falls back to a legacy product-level cost for a single-variant product", () => {
    assert.equal(
      resolveEffectiveComparisonCost(
        [costProfile({ shopifyVariantId: "", totalCost: "18.00" })],
        "var_black",
        1,
      ),
      "18.00",
    );
  });

  it("does not treat missing cost as zero", () => {
    assert.equal(
      resolveEffectiveComparisonCost([], "var_black", 1),
      null,
    );
  });

  it("does not use a sibling variant cost for a variant that has none", () => {
    assert.equal(
      resolveEffectiveComparisonCost(
        [costProfile({ shopifyVariantId: "var_red", totalCost: "20.00" })],
        "var_black",
        2,
      ),
      null,
    );
  });
});

describe("buildComparisonProduct and variant switching", () => {
  const variants: ComparisonVariantSource[] = [
    { id: "var_black", title: "Black / Medium", price: "50.00", unitCost: "24.00" },
    { id: "var_red", title: "Red / Large", price: "90.00", unitCost: null },
  ];

  it("automatically uses the only variant", () => {
    const product = buildComparisonProduct({
      trackedProductId: "tp_1",
      title: "Classic T-Shirt",
      imageUrl: null,
      imageAlt: null,
      currency: "USD",
      variants: [variants[0]],
      profiles: [
        costProfile({ shopifyVariantId: "var_black", totalCost: "24.00" }),
      ],
      selectedShopifyVariantId: null,
    });

    assert.equal(product.defaultVariantId, "var_black");
    assert.equal(product.variants.length, 1);
    assert.equal(product.variants[0].title, "Black / Medium");
    assert.equal(product.variants[0].effectiveCost, "24.00");
  });

  it("lets a multi-variant product change the active variant", () => {
    const product = buildComparisonProduct({
      trackedProductId: "tp_2",
      title: "Running Shoes",
      imageUrl: null,
      imageAlt: null,
      currency: "USD",
      variants,
      profiles: [
        costProfile({ shopifyVariantId: "var_black", totalCost: "24.00" }),
        costProfile({ shopifyVariantId: "var_red", totalCost: "52.00" }),
      ],
      selectedShopifyVariantId: "var_black",
    });

    const black = resolveActiveComparisonSnapshot(product, "var_black");
    const red = resolveActiveComparisonSnapshot(product, "var_red");

    assert.equal(black.variantTitle, "Black / Medium");
    assert.equal(black.currentPrice, "50.00");
    assert.equal(black.effectiveCost, "24.00");
    assert.equal(red.variantTitle, "Red / Large");
    assert.equal(red.currentPrice, "90.00");
    assert.equal(red.effectiveCost, "52.00");
  });

  it("keeps ready products available when another selected product is missing cost", () => {
    const ready = buildComparisonProduct({
      trackedProductId: "tp_ready",
      title: "Classic T-Shirt",
      imageUrl: null,
      imageAlt: null,
      currency: "USD",
      variants: [variants[0]],
      profiles: [
        costProfile({ shopifyVariantId: "var_black", totalCost: "24.00" }),
      ],
      selectedShopifyVariantId: null,
    });
    const missing = buildComparisonProduct({
      trackedProductId: "tp_missing",
      title: "Baseball Cap",
      imageUrl: null,
      imageAlt: null,
      currency: "USD",
      variants: [
        { id: "var_cap", title: "Default Title", price: "30.00", unitCost: null },
      ],
      profiles: [],
      selectedShopifyVariantId: null,
    });

    const snapshots = [
      resolveActiveComparisonSnapshot(ready),
      resolveActiveComparisonSnapshot(missing),
    ];
    const summary = summarizeComparisonReadiness(snapshots);

    assert.equal(summary.selectedCount, 2);
    assert.equal(summary.readyCount, 1);
    assert.equal(summary.needsCostCount, 1);
    assert.equal(snapshots[0].costReady, true);
    assert.equal(snapshots[1].costReady, false);
    assert.equal(snapshots[1].effectiveCost, null);
    assert.equal(
      formatComparisonReadinessSummary(summary.readyCount, summary.needsCostCount),
      "1 ready · 1 needs cost",
    );
  });
});

describe("current margin", () => {
  it("matches the existing ProfitPilot simulator with no strategies", () => {
    const baseline = { sellingPrice: "50.00", totalCost: "24.00" };
    const comparison = computeCurrentProjectedOutcome(baseline);
    const existing = simulateProjectedOutcome(baseline, {
      activeIds: [],
      fields: EMPTY_STRATEGY_FIELDS,
      customStrategies: [],
    });

    assert.equal(comparison.marginPercent, existing.marginPercent);
    assert.equal(comparison.profitLoss, existing.profitLoss);
    assert.equal(formatCurrentComparisonMargin("50.00", "24.00"), "52.0%");
    assert.equal(formatCurrentComparisonMargin("90.00", "52.00"), "42.2%");
  });

  it("does not fabricate margin when cost is missing", () => {
    const missing = computeCurrentProjectedOutcome({
      sellingPrice: "30.00",
      totalCost: null,
    });
    const zeroCost = computeCurrentProjectedOutcome({
      sellingPrice: "30.00",
      totalCost: "0",
    });

    assert.equal(missing.marginPercent, null);
    assert.equal(missing.profitLoss, null);
    assert.equal(formatCurrentComparisonMargin("30.00", null), "—");
    assert.notEqual(zeroCost.marginPercent, missing.marginPercent);
  });
});

describe("displayComparisonVariantTitle", () => {
  it("uses Default for a single Default Title variant", () => {
    assert.equal(displayComparisonVariantTitle("Default Title", 1), "Default");
  });
});

describe("multi-product simulation parity", () => {
  const shirt = { sellingPrice: "50.00", totalCost: "24.00" };
  const shoes = { sellingPrice: "90.00", totalCost: "52.00" };

  it("matches the existing single-product simulator for the same input", () => {
    const strategies = strategyInputs(["discount"], {
      discount: { type: "percentage", value: "20" },
    });

    const comparison = simulateComparisonRow(shirt, strategies, {
      costReady: true,
    });
    const existing = simulateProjectedOutcome(shirt, strategies);

    assert.deepEqual(comparison.simulatedOutcome, existing);
    assert.equal(comparison.calculationsPaused, false);
  });

  it("calculates each product independently under the same shared scenario", () => {
    const strategies = strategyInputs(["discount"], {
      discount: { type: "percentage", value: "20" },
    });

    const shirtResult = simulateComparisonRow(shirt, strategies, {
      costReady: true,
    });
    const shoesResult = simulateComparisonRow(shoes, strategies, {
      costReady: true,
    });

    assert.deepEqual(
      shirtResult.simulatedOutcome,
      simulateProjectedOutcome(shirt, strategies),
    );
    assert.deepEqual(
      shoesResult.simulatedOutcome,
      simulateProjectedOutcome(shoes, strategies),
    );
    assert.notEqual(
      shirtResult.simulatedOutcome.profitLoss,
      shoesResult.simulatedOutcome.profitLoss,
    );
    assert.equal(shirtResult.simulatedOutcome.profitLoss, 16);
    assert.equal(shoesResult.simulatedOutcome.profitLoss, 20);
  });

  it("recalculates every eligible product when Discount changes", () => {
    const twenty = strategyInputs(["discount"], {
      discount: { type: "percentage", value: "20" },
    });
    const twentyFive = strategyInputs(["discount"], {
      discount: { type: "percentage", value: "25" },
    });

    const shirtAt20 = simulateComparisonRow(shirt, twenty, { costReady: true });
    const shoesAt20 = simulateComparisonRow(shoes, twenty, { costReady: true });
    const shirtAt25 = simulateComparisonRow(shirt, twentyFive, {
      costReady: true,
    });
    const shoesAt25 = simulateComparisonRow(shoes, twentyFive, {
      costReady: true,
    });

    assert.notEqual(
      shirtAt20.simulatedOutcome.profitLoss,
      shirtAt25.simulatedOutcome.profitLoss,
    );
    assert.notEqual(
      shoesAt20.simulatedOutcome.profitLoss,
      shoesAt25.simulatedOutcome.profitLoss,
    );
    assert.deepEqual(
      shirtAt25.simulatedOutcome,
      simulateProjectedOutcome(shirt, twentyFive),
    );
    assert.deepEqual(
      shoesAt25.simulatedOutcome,
      simulateProjectedOutcome(shoes, twentyFive),
    );
  });

  it("preserves existing percentage and fixed discount semantics", () => {
    const percent = strategyInputs(["discount"], {
      discount: { type: "percentage", value: "20" },
    });
    const fixed = strategyInputs(["discount"], {
      discount: { type: "fixed", value: "5" },
    });

    assert.deepEqual(
      simulateComparisonRow(shirt, percent, { costReady: true })
        .simulatedOutcome,
      simulateProjectedOutcome(shirt, percent),
    );
    assert.deepEqual(
      simulateComparisonRow(shirt, fixed, { costReady: true }).simulatedOutcome,
      simulateProjectedOutcome(shirt, fixed),
    );
    assert.equal(simulateProjectedOutcome(shirt, percent).profitLoss, 16);
    assert.equal(simulateProjectedOutcome(shirt, fixed).profitLoss, 21);
  });

  it("preserves existing Free Shipping semantics", () => {
    const strategies = strategyInputs(["free_shipping"], {
      free_shipping: { enabled: true, shippingCost: "8" },
    });
    const baseline = simulateProjectedOutcome(shirt, strategies);
    const comparison = simulateComparisonRow(shirt, strategies, {
      costReady: true,
    }).simulatedOutcome;

    assert.deepEqual(comparison, baseline);
    // $50 revenue − $24 product cost − $8 merchant-covered shipping = $18
    assert.equal(baseline.profitLoss, 18);
    assert.equal(baseline.evaluatedSellingPrice, 50);
    assert.equal(baseline.evaluatedTotalCost, 32);
    assert.equal(baseline.marginPercent, 36);
  });

  it("preserves existing Coupon semantics", () => {
    const strategies = strategyInputs(["coupon"], {
      coupon: { type: "percentage", value: "10" },
    });

    assert.deepEqual(
      simulateComparisonRow(shirt, strategies, { costReady: true })
        .simulatedOutcome,
      simulateProjectedOutcome(shirt, strategies),
    );
  });

  it("preserves existing Cashback semantics", () => {
    const strategies = strategyInputs(["cashback"], {
      cashback: { type: "percentage", value: "5" },
    });

    assert.deepEqual(
      simulateComparisonRow(shirt, strategies, { costReady: true })
        .simulatedOutcome,
      simulateProjectedOutcome(shirt, strategies),
    );
  });

  it("preserves existing Bundle Offer semantics", () => {
    const strategies = strategyInputs(["bundle_offer"], {
      bundle_offer: { bundlePrice: "40" },
    });

    assert.deepEqual(
      simulateComparisonRow(shirt, strategies, { costReady: true })
        .simulatedOutcome,
      simulateProjectedOutcome(shirt, strategies),
    );
    assert.equal(
      simulateComparisonRow(shirt, strategies, { costReady: true })
        .simulatedOutcome.evaluatedSellingPrice,
      40,
    );
  });

  it("preserves existing combined-strategy ordering and formulas", () => {
    const strategies = strategyInputs(
      ["discount", "free_shipping", "coupon", "cashback"],
      {
        discount: { type: "percentage", value: "20" },
        free_shipping: { enabled: true, shippingCost: "8" },
        coupon: { type: "fixed", value: "5" },
        cashback: { type: "percentage", value: "5" },
      },
    );

    assert.deepEqual(
      simulateComparisonRow(shirt, strategies, { costReady: true })
        .simulatedOutcome,
      simulateProjectedOutcome(shirt, strategies),
    );
  });

  it("does not fabricate profit or margin when cost is missing", () => {
    const strategies = strategyInputs(["discount"], {
      discount: { type: "percentage", value: "20" },
    });
    const missing = { sellingPrice: "30.00", totalCost: null };
    const result = simulateComparisonRow(missing, strategies, {
      costReady: false,
    });
    const existing = simulateProjectedOutcome(missing, strategies);

    assert.equal(result.costReady, false);
    assert.equal(result.simulatedOutcome.profitLoss, null);
    assert.equal(result.simulatedOutcome.marginPercent, null);
    assert.equal(result.simulatedOutcome.evaluatedSellingPrice, null);
    assert.deepEqual(result.simulatedOutcome, existing);
    assert.notEqual(
      simulateComparisonRow(
        { sellingPrice: "30.00", totalCost: "0" },
        strategies,
        { costReady: true },
      ).simulatedOutcome.profitLoss,
      result.simulatedOutcome.profitLoss,
    );
  });

  it("does not prevent ready products from calculating when another is missing cost", () => {
    const strategies = strategyInputs(["discount"], {
      discount: { type: "percentage", value: "20" },
    });
    const ready = simulateComparisonRow(shirt, strategies, { costReady: true });
    const missing = simulateComparisonRow(
      { sellingPrice: "30.00", totalCost: null },
      strategies,
      { costReady: false },
    );

    assert.equal(ready.costReady, true);
    assert.equal(ready.simulatedOutcome.profitLoss, 16);
    assert.equal(missing.costReady, false);
    assert.equal(missing.simulatedOutcome.profitLoss, null);
  });

  it("recalculates only the changed variant under the same shared scenario", () => {
    const product = buildComparisonProduct({
      trackedProductId: "tp_2",
      title: "Running Shoes",
      imageUrl: null,
      imageAlt: null,
      currency: "USD",
      variants: [
        { id: "var_black", title: "Black / Medium", price: "50.00", unitCost: "24.00" },
        { id: "var_red", title: "Red / Large", price: "90.00", unitCost: "52.00" },
      ],
      profiles: [
        costProfile({ shopifyVariantId: "var_black", totalCost: "24.00" }),
        costProfile({ shopifyVariantId: "var_red", totalCost: "52.00" }),
      ],
      selectedShopifyVariantId: "var_black",
    });
    const strategies = strategyInputs(["discount"], {
      discount: { type: "percentage", value: "20" },
    });

    const black = simulateComparisonRow(
      toComparisonSimulationBaseline(
        resolveActiveComparisonSnapshot(product, "var_black"),
      ),
      strategies,
      { costReady: true },
    );
    const red = simulateComparisonRow(
      toComparisonSimulationBaseline(
        resolveActiveComparisonSnapshot(product, "var_red"),
      ),
      strategies,
      { costReady: true },
    );

    assert.deepEqual(
      black.simulatedOutcome,
      simulateProjectedOutcome(shirt, strategies),
    );
    assert.deepEqual(
      red.simulatedOutcome,
      simulateProjectedOutcome(shoes, strategies),
    );
    assert.notEqual(
      black.simulatedOutcome.profitLoss,
      red.simulatedOutcome.profitLoss,
    );
  });

  it("removes a strategy column and its result effect when the strategy is removed", () => {
    const withDiscount = strategyInputs(["discount", "coupon"], {
      discount: { type: "percentage", value: "20" },
      coupon: { type: "percentage", value: "10" },
    });
    const withoutDiscount = removeStrategy(withDiscount, "discount");

    const columnsWithDiscount = listActiveComparisonStrategyColumns(
      withDiscount,
      "USD",
    );
    const columnsWithoutDiscount = listActiveComparisonStrategyColumns(
      withoutDiscount,
      "USD",
    );

    assert.deepEqual(
      columnsWithDiscount.map((column) => column.key),
      ["discount", "coupon"],
    );
    assert.deepEqual(
      columnsWithoutDiscount.map((column) => column.key),
      ["coupon"],
    );
    assert.notDeepEqual(
      simulateComparisonRow(shirt, withDiscount, { costReady: true })
        .simulatedOutcome,
      simulateComparisonRow(shirt, withoutDiscount, { costReady: true })
        .simulatedOutcome,
    );
    assert.deepEqual(
      simulateComparisonRow(shirt, withoutDiscount, { costReady: true })
        .simulatedOutcome,
      simulateProjectedOutcome(shirt, withoutDiscount),
    );
  });

  it("is a pure simulation and does not mutate product baselines or strategies", () => {
    const baseline = { sellingPrice: "50.00", totalCost: "24.00" };
    const strategies = strategyInputs(["discount"], {
      discount: { type: "percentage", value: "20" },
    });
    const frozenBaseline = { ...baseline };
    const frozenStrategies = structuredClone(strategies);

    simulateComparisonRow(baseline, strategies, { costReady: true });

    assert.deepEqual(baseline, frozenBaseline);
    assert.deepEqual(strategies, frozenStrategies);
  });
});

describe("dynamic comparison strategy columns", () => {
  it("omits empty workspace strategies and formats active inputs concisely", () => {
    const inactive = strategyInputs(
      ["discount", "free_shipping", "bundle_offer", "coupon", "cashback"],
    );
    const active = strategyInputs(
      ["discount", "free_shipping", "bundle_offer", "coupon", "cashback"],
      {
        discount: { type: "percentage", value: "20" },
        free_shipping: { enabled: true, shippingCost: "8" },
        coupon: { type: "fixed", value: "10" },
        cashback: { type: "percentage", value: "5" },
      },
    );

    assert.deepEqual(listActiveComparisonStrategyColumns(inactive, "USD"), []);
    assert.deepEqual(
      listActiveComparisonStrategyColumns(active, "USD").map((column) => ({
        key: column.key,
        label: column.label,
        displayValue: column.displayValue,
      })),
      [
        { key: "discount", label: "Discount", displayValue: "20%" },
        { key: "free_shipping", label: "Free Shipping", displayValue: "$8.00" },
        { key: "coupon", label: "Coupon", displayValue: "$10.00 fixed" },
        { key: "cashback", label: "Cashback", displayValue: "5%" },
      ],
    );
  });

  it("formats Bundle Offer using the configured bundle price", () => {
    const strategies = strategyInputs(["bundle_offer"], {
      bundle_offer: { bundlePrice: "40" },
    });

    assert.equal(
      formatComparisonStrategyColumnValue(
        "bundle_offer",
        strategies.fields,
        "USD",
      ),
      "$40.00",
    );
  });
});

describe("shared strategy validation aggregation", () => {
  it("keeps product-specific blocking errors off the shared controls", () => {
    const strategies = strategyInputs(["discount"], {
      discount: { type: "fixed", value: "60" },
    });
    const cheap = validateStrategyBusinessRules(
      { sellingPrice: "50.00", totalCost: "24.00" },
      strategies,
    );
    const expensive = validateStrategyBusinessRules(
      { sellingPrice: "90.00", totalCost: "52.00" },
      strategies,
    );

    const shared = aggregateSharedStrategyValidation([cheap, expensive]);

    assert.equal(cheap.hasBlockingError, true);
    assert.equal(expensive.hasBlockingError, false);
    assert.equal(shared.errors.discount, undefined);
    assert.equal(
      simulateComparisonRow(
        { sellingPrice: "90.00", totalCost: "52.00" },
        strategies,
        { costReady: true },
      ).simulatedOutcome.profitLoss,
      simulateProjectedOutcome(
        { sellingPrice: "90.00", totalCost: "52.00" },
        strategies,
      ).profitLoss,
    );
  });
});

describe("selected-product price and cost edits", () => {
  const variants: ComparisonVariantSource[] = [
    { id: "var_black", title: "Black / Medium", price: "50.00", unitCost: "24.00" },
    { id: "var_red", title: "Red / Large", price: "90.00", unitCost: "52.00" },
  ];

  it("uses ProfitPilot selling price for the selected variant, not a sibling", () => {
    assert.equal(
      resolveComparisonCurrentPrice(
        [
          costProfile({
            shopifyVariantId: "var_black",
            totalCost: "24.00",
            sellingPrice: "55.00",
          }),
          costProfile({
            shopifyVariantId: "var_red",
            totalCost: "52.00",
            sellingPrice: "95.00",
          }),
        ],
        "var_black",
        2,
        "50.00",
      ),
      "55.00",
    );
    assert.equal(
      resolveComparisonCurrentPrice(
        [
          costProfile({
            shopifyVariantId: "var_black",
            totalCost: "24.00",
            sellingPrice: "55.00",
          }),
          costProfile({
            shopifyVariantId: "var_red",
            totalCost: "52.00",
            sellingPrice: "95.00",
          }),
        ],
        "var_red",
        2,
        "90.00",
      ),
      "95.00",
    );
  });

  it("falls back to Shopify variant price when selling price is unset", () => {
    assert.equal(
      resolveComparisonCurrentPrice(
        [costProfile({ shopifyVariantId: "var_black", totalCost: "24.00" })],
        "var_black",
        2,
        "50.00",
      ),
      "50.00",
    );
  });

  it("applies a Current Price edit only to the selected variant", () => {
    const product = buildComparisonProduct({
      trackedProductId: "tp_shoes",
      title: "Running Shoes",
      imageUrl: null,
      imageAlt: null,
      currency: "USD",
      variants,
      profiles: [
        costProfile({
          shopifyVariantId: "var_black",
          totalCost: "24.00",
          sellingPrice: "50.00",
        }),
        costProfile({
          shopifyVariantId: "var_red",
          totalCost: "52.00",
          sellingPrice: "90.00",
        }),
      ],
      selectedShopifyVariantId: "var_black",
    });

    const afterBlackPriceEdit = buildComparisonProduct({
      trackedProductId: product.trackedProductId,
      title: product.title,
      imageUrl: null,
      imageAlt: null,
      currency: "USD",
      variants,
      profiles: [
        costProfile({
          shopifyVariantId: "var_black",
          totalCost: "24.00",
          sellingPrice: "60.00",
        }),
        costProfile({
          shopifyVariantId: "var_red",
          totalCost: "52.00",
          sellingPrice: "90.00",
        }),
      ],
      selectedShopifyVariantId: "var_black",
    });

    const blackBefore = resolveActiveComparisonSnapshot(product, "var_black");
    const blackAfter = resolveActiveComparisonSnapshot(
      afterBlackPriceEdit,
      "var_black",
    );
    const redAfter = resolveActiveComparisonSnapshot(
      afterBlackPriceEdit,
      "var_red",
    );

    assert.equal(blackBefore.currentPrice, "50.00");
    assert.equal(blackAfter.currentPrice, "60.00");
    assert.equal(blackAfter.costProfileVariantId, "var_black");
    assert.equal(redAfter.currentPrice, "90.00");
    assert.equal(redAfter.effectiveCost, "52.00");
  });

  it("applies a Cost edit only to the selected variant and cost profile", () => {
    const before = buildComparisonProduct({
      trackedProductId: "tp_shoes",
      title: "Running Shoes",
      imageUrl: null,
      imageAlt: null,
      currency: "USD",
      variants,
      profiles: [
        costProfile({ shopifyVariantId: "var_black", totalCost: "24.00" }),
        costProfile({
          shopifyVariantId: "var_red",
          totalCost: "52.00",
          mode: "DETAILED",
          items: [
            {
              id: "item_purchase",
              name: "Purchase",
              value: "52.00",
              unit: "FIXED",
              category: "PRODUCT",
              isActive: true,
              sortOrder: 0,
              isSystem: false,
            },
          ],
        }),
      ],
      selectedShopifyVariantId: "var_black",
    });
    const after = buildComparisonProduct({
      trackedProductId: "tp_shoes",
      title: "Running Shoes",
      imageUrl: null,
      imageAlt: null,
      currency: "USD",
      variants,
      profiles: [
        costProfile({ shopifyVariantId: "var_black", totalCost: "30.00" }),
        costProfile({
          shopifyVariantId: "var_red",
          totalCost: "52.00",
          mode: "DETAILED",
          items: [
            {
              id: "item_purchase",
              name: "Purchase",
              value: "52.00",
              unit: "FIXED",
              category: "PRODUCT",
              isActive: true,
              sortOrder: 0,
              isSystem: false,
            },
          ],
        }),
      ],
      selectedShopifyVariantId: "var_red",
    });

    const blackAfter = resolveActiveComparisonSnapshot(after, "var_black");
    const redAfter = resolveActiveComparisonSnapshot(after, "var_red");
    const blackBefore = resolveActiveComparisonSnapshot(before, "var_black");

    assert.equal(blackBefore.effectiveCost, "24.00");
    assert.equal(blackAfter.effectiveCost, "30.00");
    assert.equal(blackAfter.costMode, "QUICK_START");
    assert.equal(redAfter.effectiveCost, "52.00");
    assert.equal(redAfter.costMode, "DETAILED");
    assert.equal(redAfter.costAmounts.PURCHASE, "52.00");
    assert.equal(redAfter.currentPrice, "90.00");
  });

  it("does not let Product A edits change Product B", () => {
    const shirt = buildComparisonProduct({
      trackedProductId: "tp_shirt",
      title: "Classic T-Shirt",
      imageUrl: null,
      imageAlt: null,
      currency: "USD",
      variants: [variants[0]],
      profiles: [
        costProfile({
          shopifyVariantId: "var_black",
          totalCost: "24.00",
          sellingPrice: "50.00",
        }),
      ],
      selectedShopifyVariantId: null,
    });
    const shirtAfterPriceEdit = buildComparisonProduct({
      trackedProductId: "tp_shirt",
      title: "Classic T-Shirt",
      imageUrl: null,
      imageAlt: null,
      currency: "USD",
      variants: [variants[0]],
      profiles: [
        costProfile({
          shopifyVariantId: "var_black",
          totalCost: "24.00",
          sellingPrice: "70.00",
        }),
      ],
      selectedShopifyVariantId: null,
    });
    const shoes = buildComparisonProduct({
      trackedProductId: "tp_shoes",
      title: "Running Shoes",
      imageUrl: null,
      imageAlt: null,
      currency: "USD",
      variants: [variants[1]],
      profiles: [
        costProfile({
          shopifyVariantId: "var_red",
          totalCost: "52.00",
          sellingPrice: "90.00",
        }),
      ],
      selectedShopifyVariantId: null,
    });

    const shirtSnapshot = resolveActiveComparisonSnapshot(shirtAfterPriceEdit);
    const shoesSnapshot = resolveActiveComparisonSnapshot(shoes);

    assert.equal(shirtSnapshot.currentPrice, "70.00");
    assert.equal(resolveActiveComparisonSnapshot(shirt).currentPrice, "50.00");
    assert.equal(shoesSnapshot.currentPrice, "90.00");
    assert.equal(shoesSnapshot.effectiveCost, "52.00");
  });

  it("recalculates Current Margin after a price or cost edit", () => {
    assert.equal(formatCurrentComparisonMargin("100.00", "40.00"), "60.0%");
    assert.equal(formatCurrentComparisonMargin("110.00", "40.00"), "63.6%");
    assert.equal(formatCurrentComparisonMargin("100.00", "50.00"), "50.0%");
  });

  it("recalculates the simulation for the edited product only", () => {
    const strategies = strategyInputs(["discount"], {
      discount: { type: "percentage", value: "20" },
    });
    const productABefore = simulateComparisonRow(
      { sellingPrice: "100.00", totalCost: "40.00" },
      strategies,
      { costReady: true },
    );
    const productAAfterPrice = simulateComparisonRow(
      { sellingPrice: "110.00", totalCost: "40.00" },
      strategies,
      { costReady: true },
    );
    const productAAfterCost = simulateComparisonRow(
      { sellingPrice: "100.00", totalCost: "50.00" },
      strategies,
      { costReady: true },
    );
    const productB = simulateComparisonRow(
      { sellingPrice: "90.00", totalCost: "52.00" },
      strategies,
      { costReady: true },
    );
    const productBAgain = simulateComparisonRow(
      { sellingPrice: "90.00", totalCost: "52.00" },
      strategies,
      { costReady: true },
    );

    assert.notEqual(
      productAAfterPrice.simulatedOutcome.profitLoss,
      productABefore.simulatedOutcome.profitLoss,
    );
    assert.notEqual(
      productAAfterCost.simulatedOutcome.profitLoss,
      productABefore.simulatedOutcome.profitLoss,
    );
    assert.deepEqual(productBAgain.simulatedOutcome, productB.simulatedOutcome);
    assert.equal(strategies.fields.discount.value, "20");
    assert.deepEqual(strategies.activeIds, ["discount"]);
  });

  it("keeps shared Decision Strategies unchanged when baselines change", () => {
    const strategies = strategyInputs(
      ["discount", "free_shipping", "coupon", "cashback"],
      {
        discount: { type: "percentage", value: "20" },
        free_shipping: { enabled: true, shippingCost: "8" },
        coupon: { type: "fixed", value: "10" },
        cashback: { type: "percentage", value: "5" },
      },
    );
    const columnsBefore = listActiveComparisonStrategyColumns(strategies, "USD");

    simulateComparisonRow(
      { sellingPrice: "110.00", totalCost: "45.00" },
      strategies,
      { costReady: true },
    );

    assert.deepEqual(
      listActiveComparisonStrategyColumns(strategies, "USD"),
      columnsBefore,
    );
    assert.equal(strategies.fields.discount.value, "20");
    assert.equal(strategies.fields.free_shipping.shippingCost, "8");
    assert.equal(strategies.fields.coupon.value, "10");
    assert.equal(strategies.fields.cashback.value, "5");
  });

  it("still treats missing cost as Add cost, not a fabricated zero cost", () => {
    const missing = buildComparisonProduct({
      trackedProductId: "tp_cap",
      title: "Baseball Cap",
      imageUrl: null,
      imageAlt: null,
      currency: "USD",
      variants: [
        { id: "var_cap", title: "Default Title", price: "30.00", unitCost: null },
      ],
      profiles: [],
      selectedShopifyVariantId: null,
    });
    const snapshot = resolveActiveComparisonSnapshot(missing);

    assert.equal(snapshot.costReady, false);
    assert.equal(snapshot.effectiveCost, null);
    assert.equal(snapshot.costMode, null);
    assert.equal(snapshot.currentPrice, "30.00");
    assert.equal(snapshot.costProfileVariantId, "var_cap");
  });
});

function costProfile(input: {
  shopifyVariantId: string;
  totalCost: string | null;
  sellingPrice?: string | null;
  mode?: CostProfile["mode"];
  items?: CostProfile["items"];
}): CostProfile {
  return {
    id: `cp_${input.shopifyVariantId || "product"}`,
    shop: "shop-a.myshopify.com",
    productId: "gid://shopify/Product/1",
    shopifyVariantId: input.shopifyVariantId,
    currency: "USD",
    mode: input.mode ?? "QUICK_START",
    totalCost: input.totalCost,
    sellingPrice: input.sellingPrice ?? null,
    notes: null,
    items: input.items ?? [],
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

function strategyInputs(
  activeIds: StrategyId[],
  fieldPatches: Partial<StrategyFieldMap> = {},
): StrategyInputs {
  return {
    activeIds,
    fields: { ...EMPTY_STRATEGY_FIELDS, ...fieldPatches },
    customStrategies: [],
  };
}
