import {
  DEFAULT_ACTIVE_STRATEGY_IDS,
  type StrategyId,
} from "./strategyCatalog";

export type DiscountType = "percentage" | "fixed";

export type DiscountFields = {
  type: DiscountType;
  value: string;
};

export type FreeShippingFields = {
  enabled: boolean;
  /** Merchant-entered amount deducted when Free Shipping is enabled. */
  shippingCost: string;
};

export type BundleOfferFields = {
  bundlePrice: string;
};

export type CouponFields = {
  type: DiscountType;
  value: string;
};

export type CashbackFields = {
  type: DiscountType;
  value: string;
};

export type BuyXGetYFields = {
  buyQty: string;
  getQty: string;
};

export type FlashSaleFields = {
  percentOff: string;
};

export type ReferralBonusFields = {
  amount: string;
};

export type QuantityDiscountFields = {
  /** Minimum order quantity required before the discount applies. */
  minQuantity: string;
  type: DiscountType;
  value: string;
  /** Order size used for live threshold simulation. */
  simulatedQuantity: string;
};

export type GiftWithPurchaseFields = {
  giftCost: string;
};

export type LoyaltyRewardFields = {
  percent: string;
};

/**
 * Per-strategy field bags. New strategies add a key here and an applier —
 * the workspace list stays data-driven.
 */
export type StrategyFieldMap = {
  discount: DiscountFields;
  free_shipping: FreeShippingFields;
  bundle_offer: BundleOfferFields;
  coupon: CouponFields;
  cashback: CashbackFields;
  buy_x_get_y: BuyXGetYFields;
  flash_sale: FlashSaleFields;
  referral_bonus: ReferralBonusFields;
  quantity_discount: QuantityDiscountFields;
  gift_with_purchase: GiftWithPurchaseFields;
  loyalty_reward: LoyaltyRewardFields;
};

/**
 * Ephemeral Decision Workspace simulation state.
 * Empty / unchecked controls leave a strategy inactive in the math.
 */
export type StrategyInputs = {
  activeIds: StrategyId[];
  fields: StrategyFieldMap;
};

export type SimulationBaseline = {
  sellingPrice: string | null;
  totalCost: string | null;
};

export type OutcomeStatus = "Profit" | "Loss";

export type ProjectedOutcome = {
  profitLoss: number | null;
  marginPercent: number | null;
  status: OutcomeStatus | null;
  /** Per-unit price after unit-level strategies — safe to write to Shopify variant price. */
  evaluatedSellingPrice: number | null;
};

export const EMPTY_STRATEGY_FIELDS: StrategyFieldMap = {
  discount: { type: "percentage", value: "" },
  free_shipping: { enabled: false, shippingCost: "" },
  bundle_offer: { bundlePrice: "" },
  coupon: { type: "percentage", value: "" },
  cashback: { type: "percentage", value: "" },
  buy_x_get_y: { buyQty: "", getQty: "" },
  flash_sale: { percentOff: "" },
  referral_bonus: { amount: "" },
  quantity_discount: {
    minQuantity: "",
    type: "percentage",
    value: "",
    simulatedQuantity: "",
  },
  gift_with_purchase: { giftCost: "" },
  loyalty_reward: { percent: "" },
};

export const EMPTY_STRATEGY_INPUTS: StrategyInputs = {
  activeIds: [...DEFAULT_ACTIVE_STRATEGY_IDS],
  fields: EMPTY_STRATEGY_FIELDS,
};

function parseOptionalAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return null;
  }

  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  return value;
}

function parseOptionalPositiveInt(raw: string): number | null {
  const value = parseOptionalAmount(raw);
  if (value == null || !Number.isInteger(value) || value <= 0) {
    return null;
  }
  return value;
}

function parseRequiredAmount(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") {
    return null;
  }

  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return null;
  }

  return value;
}

function applyMoneyOff(
  revenue: number,
  type: DiscountType,
  rawValue: string,
): number {
  const amount = parseOptionalAmount(rawValue);
  if (amount == null) {
    return revenue;
  }

  if (type === "percentage") {
    // Do not silently cap — callers must validate impossible percentages.
    return revenue * (1 - amount / 100);
  }

  // Do not clamp below $0 — callers must validate impossible strategies.
  return revenue - amount;
}

function applyPercentOff(revenue: number, rawPercent: string): number {
  const percent = parseOptionalAmount(rawPercent);
  if (percent == null) {
    return revenue;
  }

  // Do not silently cap — callers must validate impossible percentages.
  return revenue * (1 - percent / 100);
}

type SimulationDraft = {
  revenue: number;
  cost: number;
  /** Unit cost before promotional adjustments — used by Buy X Get Y. */
  unitCost: number;
  /** Per-unit selling price — updated only by unit-level price strategies. */
  unitSellingPrice: number;
};

type StrategyApplier = (
  draft: SimulationDraft,
  fields: StrategyFieldMap,
) => SimulationDraft;

/**
 * Unified effect pipeline — every active strategy runs through the same draft.
 * Add a new strategy by registering an applier; do not fork calculation paths.
 */
const STRATEGY_APPLIERS: Record<StrategyId, StrategyApplier> = {
  discount: (draft, fields) => ({
    ...draft,
    revenue: applyMoneyOff(
      draft.revenue,
      fields.discount.type,
      fields.discount.value,
    ),
    unitSellingPrice: applyMoneyOff(
      draft.unitSellingPrice,
      fields.discount.type,
      fields.discount.value,
    ),
  }),

  free_shipping: (draft, fields) => {
    if (!fields.free_shipping.enabled) {
      return draft;
    }
    const shipping = parseOptionalAmount(fields.free_shipping.shippingCost);
    if (shipping == null || shipping <= 0) {
      return draft;
    }
    return { ...draft, cost: draft.cost + shipping };
  },

  bundle_offer: (draft) => {
    // Bundle price is applied as the revenue baseline before the pipeline loop.
    return draft;
  },

  coupon: (draft, fields) => ({
    ...draft,
    revenue: applyMoneyOff(
      draft.revenue,
      fields.coupon.type,
      fields.coupon.value,
    ),
    unitSellingPrice: applyMoneyOff(
      draft.unitSellingPrice,
      fields.coupon.type,
      fields.coupon.value,
    ),
  }),

  cashback: (draft, fields) => {
    const amount = parseOptionalAmount(fields.cashback.value);
    if (amount == null) {
      return draft;
    }
    if (fields.cashback.type === "percentage") {
      const cashbackCost = draft.revenue * (Math.min(amount, 100) / 100);
      return { ...draft, cost: draft.cost + cashbackCost };
    }
    return { ...draft, cost: draft.cost + amount };
  },

  buy_x_get_y: (draft, fields) => {
    const buyQty = parseOptionalPositiveInt(fields.buy_x_get_y.buyQty);
    const getQty = parseOptionalPositiveInt(fields.buy_x_get_y.getQty);
    if (buyQty == null || getQty == null) {
      return draft;
    }
    // Order-level: pay for Buy qty; fulfill Buy + Free at full unit cost.
    const totalUnits = buyQty + getQty;
    return {
      ...draft,
      revenue: draft.revenue * buyQty,
      cost: draft.cost + draft.unitCost * (totalUnits - 1),
    };
  },

  flash_sale: (draft, fields) => ({
    ...draft,
    revenue: applyPercentOff(draft.revenue, fields.flash_sale.percentOff),
    unitSellingPrice: applyPercentOff(
      draft.unitSellingPrice,
      fields.flash_sale.percentOff,
    ),
  }),

  referral_bonus: (draft, fields) => {
    const amount = parseOptionalAmount(fields.referral_bonus.amount);
    if (amount == null) {
      return draft;
    }
    return { ...draft, cost: draft.cost + amount };
  },

  quantity_discount: (draft, fields) => {
    const minQuantity = parseOptionalPositiveInt(
      fields.quantity_discount.minQuantity,
    );
    const simulatedQuantity = parseOptionalPositiveInt(
      fields.quantity_discount.simulatedQuantity,
    );
    const discountValue = parseOptionalAmount(fields.quantity_discount.value);

    // Inactive until Minimum Quantity and Discount Value are both set (> 0).
    if (minQuantity == null || discountValue == null || discountValue <= 0) {
      return draft;
    }

    // Simulated qty required to project an order-level outcome.
    if (simulatedQuantity == null) {
      return draft;
    }

    const orderCost = draft.cost + draft.unitCost * (simulatedQuantity - 1);

    // Below threshold — no discount; project the order at the full unit price.
    if (simulatedQuantity < minQuantity) {
      return {
        ...draft,
        revenue: draft.revenue * simulatedQuantity,
        cost: orderCost,
      };
    }

    // Threshold met — reuse Discount's unit-price reduction, then scale.
    const unitRevenue = applyMoneyOff(
      draft.revenue,
      fields.quantity_discount.type,
      fields.quantity_discount.value,
    );

    return {
      ...draft,
      revenue: unitRevenue * simulatedQuantity,
      unitSellingPrice: applyMoneyOff(
        draft.unitSellingPrice,
        fields.quantity_discount.type,
        fields.quantity_discount.value,
      ),
      cost: orderCost,
    };
  },

  gift_with_purchase: (draft, fields) => {
    const giftCost = parseOptionalAmount(fields.gift_with_purchase.giftCost);
    if (giftCost == null) {
      return draft;
    }
    return { ...draft, cost: draft.cost + giftCost };
  },

  loyalty_reward: (draft, fields) => {
    const percent = parseOptionalAmount(fields.loyalty_reward.percent);
    if (percent == null) {
      return draft;
    }
    const rewardCost = draft.revenue * (Math.min(percent, 100) / 100);
    return { ...draft, cost: draft.cost + rewardCost };
  },
};

/**
 * Client-side projection for the Decision Workspace simulator.
 * Every active strategy participates in one shared pipeline.
 */
export function simulateProjectedOutcome(
  baseline: SimulationBaseline,
  strategies: StrategyInputs,
): ProjectedOutcome {
  const sellingPrice = parseRequiredAmount(baseline.sellingPrice);
  const totalCost = parseRequiredAmount(baseline.totalCost);

  if (sellingPrice == null || totalCost == null) {
    return {
      profitLoss: null,
      marginPercent: null,
      status: null,
      evaluatedSellingPrice: null,
    };
  }

  // Bundle price (when set) replaces selling price as the shared revenue baseline
  // so later discounts still apply on top — order in the UI list does not matter.
  let startingRevenue = sellingPrice;
  if (strategies.activeIds.includes("bundle_offer")) {
    const bundlePrice = parseOptionalAmount(
      strategies.fields.bundle_offer.bundlePrice,
    );
    if (bundlePrice != null) {
      startingRevenue = bundlePrice;
    }
  }

  let draft: SimulationDraft = {
    revenue: startingRevenue,
    cost: totalCost,
    unitCost: totalCost,
    unitSellingPrice: startingRevenue,
  };

  for (const strategyId of strategies.activeIds) {
    const apply = STRATEGY_APPLIERS[strategyId];
    draft = apply(draft, strategies.fields);
  }

  const profitLoss = draft.revenue - draft.cost;
  const marginPercent =
    draft.revenue > 0 ? (profitLoss / draft.revenue) * 100 : null;

  const evaluatedSellingPrice =
    draft.unitSellingPrice > 0 && Number.isFinite(draft.unitSellingPrice)
      ? draft.unitSellingPrice
      : null;

  return {
    profitLoss,
    marginPercent,
    status: profitLoss >= 0 ? "Profit" : "Loss",
    evaluatedSellingPrice,
  };
}

/** Normalizes a simulation unit price for display and Shopify submission. */
export function formatEvaluatedSellingPrice(
  amount: number | null,
): string | null {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return amount.toFixed(2);
}

export function addStrategy(
  strategies: StrategyInputs,
  strategyId: StrategyId,
): StrategyInputs {
  if (strategies.activeIds.includes(strategyId)) {
    return strategies;
  }

  return {
    ...strategies,
    activeIds: [...strategies.activeIds, strategyId],
  };
}

export function removeStrategy(
  strategies: StrategyInputs,
  strategyId: StrategyId,
): StrategyInputs {
  return {
    ...strategies,
    activeIds: strategies.activeIds.filter((id) => id !== strategyId),
  };
}

export function patchStrategyFields<K extends StrategyId>(
  strategies: StrategyInputs,
  strategyId: K,
  partial: Partial<StrategyFieldMap[K]>,
): StrategyInputs {
  return {
    ...strategies,
    fields: {
      ...strategies.fields,
      [strategyId]: {
        ...strategies.fields[strategyId],
        ...partial,
      },
    },
  };
}

/** Display Profit / Loss with an explicit sign, e.g. +$125.00 or -$35.00. */
export function formatProfitLoss(
  amount: number | null,
  currency: string,
): string {
  if (amount == null || !Number.isFinite(amount)) {
    return "—";
  }

  const absolute = Math.abs(amount);
  let formatted: string;

  try {
    formatted = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(absolute);
  } catch {
    formatted = `${currency} ${absolute.toFixed(2)}`;
  }

  if (amount > 0) {
    return `+${formatted}`;
  }
  if (amount < 0) {
    return `-${formatted}`;
  }
  return formatted;
}

export function formatMarginPercent(marginPercent: number | null): string {
  if (marginPercent == null || !Number.isFinite(marginPercent)) {
    return "—";
  }

  return `${marginPercent.toFixed(1)}%`;
}
