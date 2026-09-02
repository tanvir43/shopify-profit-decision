/**
 * Per-strategy activation rules (PP-0015.3.1).
 *
 * Workspace membership (`activeIds`) means a strategy is on the Decision
 * Workspace list. Activation means the merchant has engaged the control
 * (value > 0, or checkbox checked). Compatibility analysis uses activation only.
 */

import type { StrategyId } from "./strategyCatalog";
import type { StrategyFieldMap, StrategyInputs } from "./simulateProjectedOutcome";

type StrategyActivation = (fields: StrategyFieldMap) => boolean;

function hasPositiveAmount(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return false;
  }

  const value = Number(trimmed);
  return Number.isFinite(value) && value > 0;
}

function hasPositiveInt(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return false;
  }

  const value = Number(trimmed);
  return Number.isFinite(value) && Number.isInteger(value) && value > 0;
}

/**
 * Each strategy owns its activation rule. The warning engine asks
 * "are you active?" — it does not hard-code strategy-name branches.
 */
const STRATEGY_ACTIVATION: Record<StrategyId, StrategyActivation> = {
  discount: (fields) => hasPositiveAmount(fields.discount.value),
  free_shipping: (fields) => fields.free_shipping.enabled === true,
  bundle_offer: (fields) => hasPositiveAmount(fields.bundle_offer.bundlePrice),
  coupon: (fields) => hasPositiveAmount(fields.coupon.value),
  cashback: (fields) => hasPositiveAmount(fields.cashback.value),
  buy_x_get_y: (fields) =>
    hasPositiveInt(fields.buy_x_get_y.buyQty) &&
    hasPositiveInt(fields.buy_x_get_y.getQty),
  flash_sale: (fields) => hasPositiveAmount(fields.flash_sale.percentOff),
  referral_bonus: (fields) => hasPositiveAmount(fields.referral_bonus.amount),
  quantity_discount: (fields) =>
    hasPositiveInt(fields.quantity_discount.minQuantity) &&
    hasPositiveAmount(fields.quantity_discount.value),
  gift_with_purchase: (fields) =>
    hasPositiveAmount(fields.gift_with_purchase.giftCost),
  loyalty_reward: (fields) => hasPositiveAmount(fields.loyalty_reward.percent),
};

/** True when a custom strategy's controls make it participate in analysis. */
export function isCustomStrategyActive(strategy: {
  type: string;
  value: string;
}): boolean {
  return hasPositiveAmount(strategy.value);
}

/** True when the strategy's controls make it participate in analysis. */
export function isStrategyActive(
  strategyId: StrategyId,
  fields: StrategyFieldMap,
): boolean {
  return STRATEGY_ACTIVATION[strategyId](fields);
}

/**
 * Workspace strategies that are currently active (value > 0 / checked).
 * Inactive or empty strategies are excluded.
 */
export function getActiveStrategyIds(
  strategies: StrategyInputs,
): StrategyId[] {
  return strategies.activeIds.filter((strategyId) =>
    isStrategyActive(strategyId, strategies.fields),
  );
}
