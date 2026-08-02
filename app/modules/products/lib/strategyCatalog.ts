/**
 * Predefined Decision Workspace strategies.
 * Strategies are business decisions — not product cost inputs.
 * Extend this catalog to add strategies without redesigning the page.
 *
 * Categories are internal metadata for compatibility analysis (PP-0015.3).
 * Do not expose category labels in the merchant UI.
 */

export const STRATEGY_IDS = [
  "discount",
  "free_shipping",
  "bundle_offer",
  "coupon",
  "cashback",
  "buy_x_get_y",
  "flash_sale",
  "referral_bonus",
  "quantity_discount",
  "gift_with_purchase",
  "loyalty_reward",
] as const;

export type StrategyId = (typeof STRATEGY_IDS)[number];

/**
 * Internal strategy taxonomy used by the compatibility engine.
 * Not shown in the Decision Workspace UI.
 */
export const STRATEGY_CATEGORIES = [
  "price_adjustment",
  "fulfillment",
  "reward",
] as const;

export type StrategyCategory = (typeof STRATEGY_CATEGORIES)[number];

export type StrategyDefinition = {
  id: StrategyId;
  label: string;
  /** Short library description. */
  description: string;
  /** Compatibility metadata — never rendered as a category chip. */
  category: StrategyCategory;
};

export const STRATEGY_CATALOG: Record<StrategyId, StrategyDefinition> = {
  discount: {
    id: "discount",
    label: "Discount",
    description: "Reduce the selling price by a percentage or fixed amount.",
    category: "price_adjustment",
  },
  free_shipping: {
    id: "free_shipping",
    label: "Free Shipping",
    description: "Absorb shipping cost as part of the offer.",
    category: "fulfillment",
  },
  bundle_offer: {
    id: "bundle_offer",
    label: "Bundle Offer",
    description: "Sell at a bundle price and project the outcome.",
    category: "price_adjustment",
  },
  coupon: {
    id: "coupon",
    label: "Coupon",
    description: "Apply a coupon discount on top of the base price.",
    category: "price_adjustment",
  },
  cashback: {
    id: "cashback",
    label: "Cashback",
    description: "Return a portion of the sale as cashback.",
    category: "reward",
  },
  buy_x_get_y: {
    id: "buy_x_get_y",
    label: "Buy X Get Y",
    description: "Customer pays for X units and receives Y free.",
    category: "price_adjustment",
  },
  flash_sale: {
    id: "flash_sale",
    label: "Flash Sale",
    description: "Temporary percentage-off promotion.",
    category: "price_adjustment",
  },
  referral_bonus: {
    id: "referral_bonus",
    label: "Referral Bonus",
    description: "Reward amount paid when a referral converts.",
    category: "reward",
  },
  quantity_discount: {
    id: "quantity_discount",
    label: "Quantity Discount",
    description: "Percentage off for bulk purchases.",
    category: "price_adjustment",
  },
  gift_with_purchase: {
    id: "gift_with_purchase",
    label: "Gift With Purchase",
    description: "Include a gift and account for its cost.",
    category: "reward",
  },
  loyalty_reward: {
    id: "loyalty_reward",
    label: "Loyalty Reward",
    description: "Loyalty points or reward as a percent of revenue.",
    category: "reward",
  },
};

/**
 * MVP strategies shown when the Decision Workspace opens.
 * Display order matches the product default library.
 */
export const DEFAULT_ACTIVE_STRATEGY_IDS: readonly StrategyId[] = [
  "discount",
  "free_shipping",
  "bundle_offer",
  "coupon",
  "cashback",
] as const;

export function getStrategyDefinition(id: StrategyId): StrategyDefinition {
  return STRATEGY_CATALOG[id];
}

export function listLibraryStrategies(
  activeIds: readonly StrategyId[],
): StrategyDefinition[] {
  const active = new Set(activeIds);
  return STRATEGY_IDS.filter((id) => !active.has(id)).map(
    (id) => STRATEGY_CATALOG[id],
  );
}
