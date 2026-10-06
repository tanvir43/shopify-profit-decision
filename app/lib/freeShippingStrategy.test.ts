import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { simulateComparisonRow } from "../modules/products/lib/compareScenarios";
import {
  EMPTY_STRATEGY_FIELDS,
  simulateProjectedOutcome,
  type StrategyFieldMap,
  type StrategyInputs,
} from "../modules/products/lib/simulateProjectedOutcome";
import {
  STRATEGY_CATALOG,
  type StrategyId,
} from "../modules/products/lib/strategyCatalog";
import { validateShippingCost } from "../modules/products/lib/validateShippingCost";

const STRATEGY_CONTROLS_SOURCE = readFileSync(
  fileURLToPath(
    new URL(
      "../modules/products/components/StrategyControls.tsx",
      import.meta.url,
    ),
  ),
  "utf8",
);

const PRODUCT_DECISION_SOURCE = readFileSync(
  fileURLToPath(
    new URL(
      "../modules/products/ProductDecisionDashboardPage.tsx",
      import.meta.url,
    ),
  ),
  "utf8",
);

const COMPARE_PAGE_SOURCE = readFileSync(
  fileURLToPath(
    new URL("../modules/products/CompareScenariosPage.tsx", import.meta.url),
  ),
  "utf8",
);

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

describe("Free Shipping merchant-facing copy", () => {
  it("labels the control Offer free shipping", () => {
    assert.match(
      STRATEGY_CONTROLS_SOURCE,
      /label="Offer free shipping"/,
    );
  });

  it("labels the amount field as the merchant-covered shipping cost", () => {
    assert.match(
      STRATEGY_CONTROLS_SOURCE,
      /label="Shipping cost you'll cover"/,
    );
  });

  it("explains that the amount is the merchant's expected shipping cost", () => {
    assert.match(
      STRATEGY_CONTROLS_SOURCE,
      /Enter the shipping cost you expect to pay for this order\./,
    );
  });

  it("does not describe the amount as a customer charge or discount", () => {
    assert.doesNotMatch(
      STRATEGY_CONTROLS_SOURCE,
      /shipping discount|shipping offer amount|customer shipping|free shipping amount|amount customer pays/i,
    );
  });

  it("is defined once in the shared StrategyControls used by single and compare pages", () => {
    assert.match(
      PRODUCT_DECISION_SOURCE,
      /import \{ StrategyControls \} from "\.\/components\/StrategyControls"/,
    );
    assert.match(
      COMPARE_PAGE_SOURCE,
      /import \{ StrategyControls \} from "\.\/components\/StrategyControls"/,
    );
    assert.doesNotMatch(PRODUCT_DECISION_SOURCE, /Offer free shipping/);
    assert.doesNotMatch(COMPARE_PAGE_SOURCE, /Offer free shipping/);
    assert.doesNotMatch(PRODUCT_DECISION_SOURCE, /Shipping cost you'll cover/);
    assert.doesNotMatch(COMPARE_PAGE_SOURCE, /Shipping cost you'll cover/);
  });
});

describe("Free Shipping strategy state and validation", () => {
  it("keeps existing enabled + shippingCost field names", () => {
    const strategies = strategyInputs(["free_shipping"], {
      free_shipping: { enabled: true, shippingCost: "10.00" },
    });

    assert.equal(strategies.fields.free_shipping.enabled, true);
    assert.equal(strategies.fields.free_shipping.shippingCost, "10.00");
  });

  it("still requires a valid positive currency amount when enabled", () => {
    assert.deepEqual(validateShippingCost(""), {
      ok: false,
      message: "Enter a shipping cost.",
    });
    assert.deepEqual(validateShippingCost("abc"), {
      ok: false,
      message: "Enter a valid amount with up to two decimal places.",
    });
    assert.deepEqual(validateShippingCost("0"), {
      ok: false,
      message: "Shipping cost must be greater than zero.",
    });
    assert.deepEqual(validateShippingCost("1000000"), {
      ok: false,
      message: "Shipping cost cannot exceed 999,999.99.",
    });
    assert.deepEqual(validateShippingCost("10"), {
      ok: true,
      value: "10.00",
    });
    assert.deepEqual(validateShippingCost("10.5"), {
      ok: true,
      value: "10.50",
    });
  });
});

describe("Free Shipping simulation semantics", () => {
  const baseline = { sellingPrice: "100.00", totalCost: "50.00" };

  it("deducts merchant-covered shipping from profit without changing selling price", () => {
    const strategies = strategyInputs(["free_shipping"], {
      free_shipping: { enabled: true, shippingCost: "10" },
    });
    const outcome = simulateProjectedOutcome(baseline, strategies);

    assert.equal(outcome.evaluatedSellingPrice, 100);
    assert.equal(outcome.evaluatedTotalCost, 60);
    assert.equal(outcome.profitLoss, 40);
    assert.equal(outcome.marginPercent, 40);
    assert.equal(outcome.status, "Profit");
  });

  it("does not deduct shipping when the offer is unchecked", () => {
    const strategies = strategyInputs(["free_shipping"], {
      free_shipping: { enabled: false, shippingCost: "10" },
    });
    const outcome = simulateProjectedOutcome(baseline, strategies);

    assert.equal(outcome.evaluatedSellingPrice, 100);
    assert.equal(outcome.evaluatedTotalCost, 50);
    assert.equal(outcome.profitLoss, 50);
    assert.equal(outcome.marginPercent, 50);
  });

  it("matches single-product and compare simulation output", () => {
    const strategies = strategyInputs(["free_shipping"], {
      free_shipping: { enabled: true, shippingCost: "10" },
    });

    assert.deepEqual(
      simulateComparisonRow(baseline, strategies, { costReady: true })
        .simulatedOutcome,
      simulateProjectedOutcome(baseline, strategies),
    );
  });
});

describe("other Decision Strategies remain unchanged", () => {
  it("keeps existing catalog names for non-shipping strategies", () => {
    assert.equal(STRATEGY_CATALOG.discount.label, "Discount");
    assert.equal(STRATEGY_CATALOG.bundle_offer.label, "Bundle Offer");
    assert.equal(STRATEGY_CATALOG.coupon.label, "Coupon");
    assert.equal(STRATEGY_CATALOG.cashback.label, "Cashback");
    assert.equal(STRATEGY_CATALOG.free_shipping.label, "Free Shipping");
  });

  it("does not rewrite Discount, Bundle, Coupon, or Cashback controls", () => {
    assert.match(STRATEGY_CONTROLS_SOURCE, /label="Discount Type"/);
    assert.match(STRATEGY_CONTROLS_SOURCE, /label="Bundle Price"/);
    assert.match(STRATEGY_CONTROLS_SOURCE, /label="Coupon Type"/);
    assert.match(STRATEGY_CONTROLS_SOURCE, /label="Cashback Type"/);
  });
});
