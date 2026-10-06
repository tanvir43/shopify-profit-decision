import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CostProfile } from "../modules/cost-profiles/types/CostProfile";
import {
  applyComparisonPriceRowsSequentially,
  buildComparisonApplyConfirmationRows,
  buildComparisonApplyFormPayload,
  buildComparisonApplySelections,
  canSubmitComparisonApply,
  clearSuccessfulComparisonApplySelection,
  comparisonApplySelectAllState,
  failedComparisonApplyResults,
  filterSelectedComparisonApplyIds,
  formatComparisonApplyConfirmHeading,
  isComparisonRowApplyEligible,
  listEligibleComparisonApplyIds,
  nextComparisonApplySelectionAfterSelectAll,
  parseComparisonApplySelections,
  parseComparisonApplyStrategies,
  readComparisonApplyFormData,
  shouldShowComparisonApplyAction,
  summarizeComparisonApplyResults,
  toggleComparisonApplySelection,
  verifyComparisonApplySelection,
  type VerifiedComparisonApplyRow,
} from "../modules/products/lib/compareApplyToShopify";
import {
  buildComparisonProduct,
  resolveActiveComparisonSnapshot,
  resolveComparisonCurrentPrice,
  resolveEffectiveComparisonCost,
  simulateComparisonRow,
  toComparisonSimulationBaseline,
  type ComparisonProduct,
  type ComparisonVariantSource,
} from "../modules/products/lib/compareScenarios";
import {
  EMPTY_STRATEGY_FIELDS,
  simulateProjectedOutcome,
  type StrategyFieldMap,
  type StrategyInputs,
} from "../modules/products/lib/simulateProjectedOutcome";
import type { StrategyId } from "../modules/products/lib/strategyCatalog";

const discount20 = strategyInputs(["discount"], {
  discount: { type: "percentage", value: "20" },
});

describe("comparison apply eligibility and selection", () => {
  it("hides the apply action when zero result rows are selected", () => {
    assert.equal(shouldShowComparisonApplyAction(0), false);
    assert.equal(canSubmitComparisonApply(false, 0), false);
  });

  it("allows one eligible row to be selected", () => {
    const { shirt, missing } = comparisonProducts();
    const rows = simulatedRows([shirt, missing], discount20);
    const eligible = listEligibleComparisonApplyIds(rows);

    assert.deepEqual(eligible, ["tp_shirt"]);

    const selected = toggleComparisonApplySelection(
      [],
      "tp_shirt",
      true,
      eligible,
    );

    assert.deepEqual(selected, ["tp_shirt"]);
    assert.equal(shouldShowComparisonApplyAction(selected.length), true);
  });

  it("allows multiple eligible rows to be selected", () => {
    const { shirt, shoes, missing } = comparisonProducts();
    const rows = simulatedRows([shirt, shoes, missing], discount20);
    const eligible = listEligibleComparisonApplyIds(rows);

    const selected = toggleComparisonApplySelection(
      toggleComparisonApplySelection([], "tp_shirt", true, eligible),
      "tp_shoes",
      true,
      eligible,
    );

    assert.deepEqual(eligible, ["tp_shirt", "tp_shoes"]);
    assert.deepEqual(selected, ["tp_shirt", "tp_shoes"]);
  });

  it("cannot apply-select ineligible or missing-result rows", () => {
    const { shirt, missing } = comparisonProducts();
    const rows = simulatedRows([shirt, missing], discount20);
    const eligible = listEligibleComparisonApplyIds(rows);
    const selected = toggleComparisonApplySelection(
      [],
      "tp_cap",
      true,
      eligible,
    );

    assert.equal(
      isComparisonRowApplyEligible({
        variantId: "var_cap",
        costReady: false,
        calculationsPaused: false,
        evaluatedSellingPrice: null,
        effectiveCost: null,
      }),
      false,
    );
    assert.deepEqual(eligible, ["tp_shirt"]);
    assert.deepEqual(selected, []);
  });

  it("select-all selects only eligible rows and reports partial selection", () => {
    const { shirt, shoes, missing } = comparisonProducts();
    const rows = simulatedRows([shirt, shoes, missing], discount20);
    const eligible = listEligibleComparisonApplyIds(rows);

    assert.deepEqual(
      nextComparisonApplySelectionAfterSelectAll(eligible, true),
      ["tp_shirt", "tp_shoes"],
    );
    assert.deepEqual(
      nextComparisonApplySelectionAfterSelectAll(eligible, false),
      [],
    );
    assert.deepEqual(
      comparisonApplySelectAllState(eligible, ["tp_shirt"]),
      { checked: false, indeterminate: true },
    );
    assert.deepEqual(
      comparisonApplySelectAllState(eligible, ["tp_shirt", "tp_shoes"]),
      { checked: true, indeterminate: false },
    );
    assert.ok(!eligible.includes("tp_cap"));
  });

  it("rejects invalid simulation results and missing variant identifiers", () => {
    assert.equal(
      isComparisonRowApplyEligible({
        variantId: "var_black",
        costReady: true,
        calculationsPaused: true,
        evaluatedSellingPrice: 40,
        effectiveCost: "24.00",
      }),
      false,
    );
    assert.equal(
      isComparisonRowApplyEligible({
        variantId: null,
        costReady: true,
        calculationsPaused: false,
        evaluatedSellingPrice: 40,
        effectiveCost: "24.00",
      }),
      false,
    );
    assert.equal(
      isComparisonRowApplyEligible({
        variantId: "var_black",
        costReady: true,
        calculationsPaused: false,
        evaluatedSellingPrice: 0,
        effectiveCost: "24.00",
      }),
      false,
    );
  });
});

describe("comparison apply confirmation", () => {
  it("contains the exact selected products and currently selected variants", () => {
    const { shirt, shoes, missing } = comparisonProducts();
    const rows = simulatedRows([shirt, shoes, missing], discount20);
    const confirmation = buildComparisonApplyConfirmationRows(rows, [
      "tp_shirt",
      "tp_shoes",
    ]);

    assert.deepEqual(
      confirmation.map((row) => ({
        trackedProductId: row.trackedProductId,
        shopifyVariantId: row.shopifyVariantId,
        productTitle: row.productTitle,
        variantTitle: row.variantTitle,
      })),
      [
        {
          trackedProductId: "tp_shirt",
          shopifyVariantId: "var_black",
          productTitle: "Classic T-Shirt",
          variantTitle: "Black / Medium",
        },
        {
          trackedProductId: "tp_shoes",
          shopifyVariantId: "var_blue",
          productTitle: "Running Shoes",
          variantTitle: "Blue / Large",
        },
      ],
    );
    assert.equal(
      formatComparisonApplyConfirmHeading(confirmation.length),
      "Apply simulated prices to 2 Shopify variants?",
    );
    assert.ok(!confirmation.some((row) => row.trackedProductId === "tp_cap"));
  });

  it("distinguishes current Shopify price from ProfitPilot current price and the new simulated price", () => {
    const shirt = buildComparisonProduct({
      trackedProductId: "tp_shirt",
      title: "Classic T-Shirt",
      imageUrl: null,
      imageAlt: null,
      currency: "USD",
      variants: [
        { id: "var_black", title: "Black / Medium", price: "100.00", unitCost: "40.00" },
      ],
      profiles: [
        costProfile({
          shopifyVariantId: "var_black",
          totalCost: "40.00",
          sellingPrice: "110.00",
        }),
      ],
      selectedShopifyVariantId: null,
    });
    const snapshot = resolveActiveComparisonSnapshot(shirt);
    const rows = simulatedRows([shirt], discount20);
    const confirmation = buildComparisonApplyConfirmationRows(rows, [
      "tp_shirt",
    ]);

    assert.equal(snapshot.currentPrice, "110.00");
    assert.equal(snapshot.shopifyPrice, "100.00");
    assert.equal(confirmation[0].currentShopifyPrice, "100.00");
    assert.equal(confirmation[0].newPrice, "88.00");
    assert.notEqual(
      confirmation[0].currentShopifyPrice,
      snapshot.currentPrice,
    );
    assert.notEqual(confirmation[0].newPrice, snapshot.currentPrice);
  });

  it("targets the current selected variant, not a sibling", () => {
    const shoes = multiVariantShoes();
    const blackRows = simulatedRows(
      [shoes],
      discount20,
      { tp_shoes: "var_black" },
    );
    const blueRows = simulatedRows(
      [shoes],
      discount20,
      { tp_shoes: "var_blue" },
    );

    const blackConfirmation = buildComparisonApplyConfirmationRows(blackRows, [
      "tp_shoes",
    ]);
    const blueConfirmation = buildComparisonApplyConfirmationRows(blueRows, [
      "tp_shoes",
    ]);

    assert.deepEqual(blackConfirmation.map((row) => row.shopifyVariantId), [
      "var_black",
    ]);
    assert.deepEqual(blueConfirmation.map((row) => row.shopifyVariantId), [
      "var_blue",
    ]);
    assert.equal(blackConfirmation[0].newPrice, "40.00");
    assert.equal(blueConfirmation[0].newPrice, "72.00");
  });
});

describe("comparison apply payload and server verification", () => {
  it("sends only selected rows and never a client-authored price", () => {
    const { shirt, shoes } = comparisonProducts();
    const rows = simulatedRows([shirt, shoes], discount20);
    const confirmation = buildComparisonApplyConfirmationRows(rows, [
      "tp_shoes",
    ]);
    const payload = buildComparisonApplyFormPayload(
      buildComparisonApplySelections(confirmation),
      discount20,
    );
    const parsedSelections = parseComparisonApplySelections(
      JSON.parse(payload.selections),
    );

    assert.deepEqual(parsedSelections, [
      { trackedProductId: "tp_shoes", shopifyVariantId: "var_blue" },
    ]);
    assert.equal("sellingPrice" in payload, false);
    assert.equal("price" in payload, false);
    assert.ok(
      parsedSelections?.every(
        (selection) => !("newPrice" in selection) && !("price" in selection),
      ),
    );
  });

  it("rejects arbitrary variant tampering that breaks the product relationship", () => {
    const { shirt, shoes } = comparisonProducts();

    const foreignVariant = verifyComparisonApplySelection({
      products: [shirt, shoes],
      selection: {
        trackedProductId: "tp_shirt",
        shopifyVariantId: "var_blue",
      },
      strategies: discount20,
    });
    const unknownProduct = verifyComparisonApplySelection({
      products: [shirt, shoes],
      selection: {
        trackedProductId: "tp_foreign",
        shopifyVariantId: "var_black",
      },
      strategies: discount20,
    });

    assert.equal(foreignVariant.ok, false);
    if (!foreignVariant.ok) {
      assert.equal(
        foreignVariant.error,
        "The selected variant does not belong to this product.",
      );
    }
    assert.equal(unknownProduct.ok, false);
    if (!unknownProduct.ok) {
      assert.equal(unknownProduct.error, "We couldn't update Shopify. Try again.");
    }
  });

  it("verifies shop-scoped ownership by refusing products that were not loaded for the shop", () => {
    const { shoes } = comparisonProducts();
    const verified = verifyComparisonApplySelection({
      products: [shoes],
      selection: {
        trackedProductId: "tp_shirt",
        shopifyVariantId: "var_black",
      },
      strategies: discount20,
    });

    assert.equal(verified.ok, false);
  });

  it("recomputes the canonical simulated price and ignores a posted arbitrary price", () => {
    const { shirt } = comparisonProducts();
    const formData = new FormData();
    formData.set(
      "selections",
      JSON.stringify([
        {
          trackedProductId: "tp_shirt",
          shopifyVariantId: "var_black",
          newPrice: "1.00",
          sellingPrice: "1.00",
        },
      ]),
    );
    formData.set("strategies", JSON.stringify(discount20));
    formData.set("sellingPrice", "1.00");

    const parsed = readComparisonApplyFormData(formData);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) {
      return;
    }

    const verified = verifyComparisonApplySelection({
      products: [shirt],
      selection: parsed.selections[0],
      strategies: parsed.strategies,
    });
    const existing = simulateProjectedOutcome(
      { sellingPrice: "50.00", totalCost: "24.00" },
      discount20,
    );

    assert.equal(verified.ok, true);
    if (verified.ok) {
      assert.equal(verified.confirmation.newPrice, "40.00");
      assert.equal(
        verified.confirmation.newPrice,
        existing.evaluatedSellingPrice?.toFixed(2),
      );
      assert.notEqual(verified.confirmation.newPrice, "1.00");
    }
  });

  it("applies only the currently selected variant and never a sibling", async () => {
    const shoes = multiVariantShoes();
    const verified = verifyComparisonApplySelection({
      products: [shoes],
      selection: {
        trackedProductId: "tp_shoes",
        shopifyVariantId: "var_blue",
      },
      strategies: discount20,
    });

    assert.equal(verified.ok, true);
    if (!verified.ok) {
      return;
    }

    const mutated: string[] = [];
    await applyComparisonPriceRowsSequentially(
      [
        {
          trackedProductId: verified.confirmation.trackedProductId,
          shopifyVariantId: verified.confirmation.shopifyVariantId,
          shopifyProductId: "gid://shopify/Product/shoes",
          productTitle: verified.confirmation.productTitle,
          variantTitle: verified.confirmation.variantTitle,
          newPrice: verified.confirmation.newPrice,
        },
      ],
      async ({ shopifyVariantId, price }) => {
        mutated.push(`${shopifyVariantId}:${price}`);
        return { ok: true };
      },
    );

    assert.deepEqual(mutated, ["var_blue:72.00"]);
    assert.ok(!mutated.some((entry) => entry.startsWith("var_black:")));
  });

  it("rejects malformed strategy or selection payloads instead of trusting them", () => {
    assert.equal(parseComparisonApplySelections(null), null);
    assert.equal(
      parseComparisonApplySelections([
        { trackedProductId: "tp_shirt", shopifyVariantId: "" },
      ]),
      null,
    );
    assert.equal(parseComparisonApplyStrategies({ activeIds: ["not-real"] }), null);
    assert.equal(
      parseComparisonApplyStrategies({
        activeIds: ["discount"],
        fields: { discount: { type: "bogus", value: "20" } },
      }),
      null,
    );
  });
});

describe("comparison apply execution and partial failure", () => {
  it("does not mutate unselected comparison rows", async () => {
    const calls: string[] = [];
    const result = await applyComparisonPriceRowsSequentially(
      [
        verifiedRow("tp_shirt", "var_black", "40.00"),
        verifiedRow("tp_shoes", "var_blue", "72.00"),
      ],
      async ({ shopifyVariantId, price }) => {
        calls.push(`${shopifyVariantId}:${price}`);
        return { ok: true };
      },
    );

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.message, "2 prices applied to Shopify.");
    }
    assert.deepEqual(calls, ["var_black:40.00", "var_blue:72.00"]);
    assert.ok(!calls.some((entry) => entry.includes("var_cap")));
  });

  it("reports partial Shopify failure without calling successful rows failed", async () => {
    const result = await applyComparisonPriceRowsSequentially(
      [
        verifiedRow("tp_shirt", "var_black", "40.00"),
        verifiedRow("tp_shoes", "var_blue", "72.00"),
        verifiedRow("tp_hat", "var_hat", "48.00"),
      ],
      async ({ shopifyVariantId }) => {
        if (shopifyVariantId === "var_blue") {
          return {
            ok: false,
            error: "Shopify could not update the selling price. Try again.",
          };
        }

        return { ok: true };
      },
    );

    assert.equal(result.ok, false);
    assert.equal(result.appliedCount, 2);
    assert.equal(result.failedCount, 1);
    assert.equal(result.error, "2 prices applied. 1 price failed.");
    assert.match(result.error, /1 price failed/);
    assert.doesNotMatch(result.error, /All prices updated/);

    const succeeded = result.results.filter((row) => row.ok);
    const failed = failedComparisonApplyResults(result.results);

    assert.deepEqual(
      succeeded.map((row) => row.trackedProductId),
      ["tp_shirt", "tp_hat"],
    );
    assert.deepEqual(
      failed.map((row) => ({
        trackedProductId: row.trackedProductId,
        shopifyVariantId: row.shopifyVariantId,
        error: row.error,
      })),
      [
        {
          trackedProductId: "tp_shoes",
          shopifyVariantId: "var_blue",
          error: "Shopify could not update the selling price. Try again.",
        },
      ],
    );
    assert.ok(succeeded.every((row) => row.ok));
    assert.ok(failed.every((row) => !row.ok));
  });

  it("clears only successful apply-selection after a mixed result", () => {
    const remaining = clearSuccessfulComparisonApplySelection(
      ["tp_shirt", "tp_shoes", "tp_hat"],
      [
        { ...identity("tp_shirt", "var_black"), ok: true },
        {
          ...identity("tp_shoes", "var_blue"),
          ok: false,
          error: "Shopify could not update the selling price. Try again.",
        },
        { ...identity("tp_hat", "var_hat"), ok: true },
      ],
    );

    assert.deepEqual(remaining, ["tp_shoes"]);
  });

  it("prevents duplicate submission while apply is pending", () => {
    assert.equal(canSubmitComparisonApply(true, 2), false);
    assert.equal(canSubmitComparisonApply(false, 2), true);
  });

  it("updates only Shopify selling prices — no discount campaign or cost/inventory mutation", async () => {
    const operations: Array<Record<string, string>> = [];

    await applyComparisonPriceRowsSequentially(
      [verifiedRow("tp_shirt", "var_black", "40.00")],
      async (input) => {
        operations.push({ ...input });
        return { ok: true };
      },
    );

    assert.deepEqual(operations, [
      {
        shopifyProductId: "gid://shopify/Product/tp_shirt",
        shopifyVariantId: "var_black",
        price: "40.00",
      },
    ]);
    assert.ok(
      operations.every(
        (operation) =>
          !("cost" in operation) &&
          !("discount" in operation) &&
          !("coupon" in operation) &&
          !("inventory" in operation) &&
          !("shipping" in operation),
      ),
    );
  });
});

describe("comparison apply preserves frozen comparison behavior", () => {
  it("preserves shared Decision Strategies after building an apply payload", () => {
    const frozen = structuredClone(discount20);
    const { shirt, shoes } = comparisonProducts();
    const rows = simulatedRows([shirt, shoes], discount20);
    const confirmation = buildComparisonApplyConfirmationRows(rows, [
      "tp_shirt",
      "tp_shoes",
    ]);

    buildComparisonApplyFormPayload(
      buildComparisonApplySelections(confirmation),
      discount20,
    );
    parseComparisonApplyStrategies(JSON.parse(JSON.stringify(discount20)));

    assert.deepEqual(discount20, frozen);
    assert.equal(discount20.fields.discount.value, "20");
    assert.deepEqual(discount20.activeIds, ["discount"]);
  });

  it("leaves existing Current Price Edit semantics unchanged", () => {
    assert.equal(
      resolveComparisonCurrentPrice(
        [
          costProfile({
            shopifyVariantId: "var_black",
            totalCost: "24.00",
            sellingPrice: "55.00",
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
        [costProfile({ shopifyVariantId: "var_black", totalCost: "24.00" })],
        "var_black",
        2,
        "50.00",
      ),
      "50.00",
    );
  });

  it("leaves existing Cost Edit semantics unchanged", () => {
    assert.equal(
      resolveEffectiveComparisonCost(
        [costProfile({ shopifyVariantId: "var_black", totalCost: "24.00" })],
        "var_black",
        2,
      ),
      "24.00",
    );
    assert.equal(
      resolveEffectiveComparisonCost(
        [costProfile({ shopifyVariantId: "var_red", totalCost: "20.00" })],
        "var_black",
        2,
      ),
      null,
    );
  });

  it("does not treat an empty apply selection as a successful Shopify update", () => {
    const empty = summarizeComparisonApplyResults([]);
    assert.equal(empty.ok, false);
    assert.equal(empty.appliedCount, 0);
    assert.deepEqual(filterSelectedComparisonApplyIds(["tp_cap"], []), []);
  });
});

function comparisonProducts(): {
  shirt: ComparisonProduct;
  shoes: ComparisonProduct;
  missing: ComparisonProduct;
} {
  const shirt = buildComparisonProduct({
    trackedProductId: "tp_shirt",
    title: "Classic T-Shirt",
    imageUrl: null,
    imageAlt: null,
    currency: "USD",
    variants: [
      { id: "var_black", title: "Black / Medium", price: "50.00", unitCost: "24.00" },
    ],
    profiles: [
      costProfile({ shopifyVariantId: "var_black", totalCost: "24.00" }),
    ],
    selectedShopifyVariantId: null,
  });
  const shoes = buildComparisonProduct({
    trackedProductId: "tp_shoes",
    title: "Running Shoes",
    imageUrl: null,
    imageAlt: null,
    currency: "USD",
    variants: [
      { id: "var_blue", title: "Blue / Large", price: "90.00", unitCost: "52.00" },
    ],
    profiles: [costProfile({ shopifyVariantId: "var_blue", totalCost: "52.00" })],
    selectedShopifyVariantId: null,
  });
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

  return { shirt, shoes, missing };
}

function multiVariantShoes(): ComparisonProduct {
  const variants: ComparisonVariantSource[] = [
    { id: "var_black", title: "Black / Medium", price: "50.00", unitCost: "24.00" },
    { id: "var_blue", title: "Blue / Large", price: "90.00", unitCost: "52.00" },
  ];

  return buildComparisonProduct({
    trackedProductId: "tp_shoes",
    title: "Running Shoes",
    imageUrl: null,
    imageAlt: null,
    currency: "USD",
    variants,
    profiles: [
      costProfile({ shopifyVariantId: "var_black", totalCost: "24.00" }),
      costProfile({ shopifyVariantId: "var_blue", totalCost: "52.00" }),
    ],
    selectedShopifyVariantId: "var_black",
  });
}

function simulatedRows(
  products: ComparisonProduct[],
  strategies: StrategyInputs,
  variantOverrides: Record<string, string> = {},
) {
  return products.map((product) => {
    const snapshot = resolveActiveComparisonSnapshot(
      product,
      variantOverrides[product.trackedProductId],
    );

    return {
      product,
      snapshot,
      simulation: simulateComparisonRow(
        toComparisonSimulationBaseline(snapshot),
        strategies,
        { costReady: snapshot.costReady },
      ),
    };
  });
}

function verifiedRow(
  trackedProductId: string,
  shopifyVariantId: string,
  newPrice: string,
): VerifiedComparisonApplyRow {
  return {
    trackedProductId,
    shopifyVariantId,
    shopifyProductId: `gid://shopify/Product/${trackedProductId}`,
    productTitle: trackedProductId,
    variantTitle: shopifyVariantId,
    newPrice,
  };
}

function identity(trackedProductId: string, shopifyVariantId: string) {
  return {
    trackedProductId,
    shopifyVariantId,
    productTitle: trackedProductId,
    variantTitle: shopifyVariantId,
  };
}

function costProfile(input: {
  shopifyVariantId: string;
  totalCost: string | null;
  sellingPrice?: string | null;
}): CostProfile {
  return {
    id: `cp_${input.shopifyVariantId || "product"}`,
    shop: "shop-a.myshopify.com",
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

