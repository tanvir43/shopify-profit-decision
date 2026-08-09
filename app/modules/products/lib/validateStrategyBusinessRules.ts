import type { StrategyId } from "./strategyCatalog";
import type {
  DiscountType,
  SimulationBaseline,
  StrategyInputs,
} from "./simulateProjectedOutcome";

export type StrategyBusinessValidation = {
  errors: Partial<Record<StrategyId, string>>;
  warnings: Partial<Record<StrategyId, string>>;
  hasBlockingError: boolean;
};

const NEGATIVE_SELLING_PRICE_STRATEGY_MESSAGE =
  "This strategy would reduce the selling price below $0, which is not possible in a real sale. Please adjust the strategy.";

const PERCENTAGE_OVER_100_MESSAGE =
  "Discount percentage cannot exceed 100%. A discount greater than 100% would require paying customers to take your product, which isn't possible in a real sale.";

const CASHBACK_EXCEEDS_MESSAGE =
  "This cashback exceeds the selling price and would result in a negative sale value. Please reduce the cashback amount.";

const BUNDLE_NEGATIVE_MESSAGE = "Bundle price cannot be negative.";

const FREE_SHIPPING_WARNING_MESSAGE =
  "Shipping cost is higher than the selling price. This strategy may result in a significant loss.";

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

/** Parses a numeric field, including negatives (for rejection messaging). */
function parseSignedAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return null;
  }

  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    return null;
  }

  return value;
}

function parseNonNegativeAmount(raw: string): number | null {
  const value = parseSignedAmount(raw);
  if (value == null || value < 0) {
    return null;
  }
  return value;
}

function parsePositiveInt(raw: string): number | null {
  const value = parseNonNegativeAmount(raw);
  if (value == null || !Number.isInteger(value) || value <= 0) {
    return null;
  }
  return value;
}

function isPercentageOver100(rawValue: string): boolean {
  const amount = parseNonNegativeAmount(rawValue);
  return amount != null && amount > 100;
}

/**
 * Money-off without silent clamping — used only to detect impossible prices.
 */
function moneyOffWithoutClamp(
  revenue: number,
  type: DiscountType,
  rawValue: string,
): number | null {
  const amount = parseNonNegativeAmount(rawValue);
  if (amount == null) {
    return null;
  }

  if (type === "percentage") {
    return revenue * (1 - amount / 100);
  }

  return revenue - amount;
}

function percentOffWithoutClamp(
  revenue: number,
  rawPercent: string,
): number | null {
  const percent = parseNonNegativeAmount(rawPercent);
  if (percent == null) {
    return null;
  }

  return revenue * (1 - percent / 100);
}

function cashbackAmount(
  revenue: number,
  type: DiscountType,
  rawValue: string,
): number | null {
  const amount = parseNonNegativeAmount(rawValue);
  if (amount == null) {
    return null;
  }

  if (type === "percentage") {
    // Do not silently cap — amounts over 100% exceed the selling price.
    return revenue * (amount / 100);
  }

  return amount;
}

/**
 * Business-rule validation for Decision Workspace strategies.
 * Blocking errors pause simulation updates; warnings never block.
 */
export function validateStrategyBusinessRules(
  baseline: SimulationBaseline,
  strategies: StrategyInputs,
): StrategyBusinessValidation {
  const errors: Partial<Record<StrategyId, string>> = {};
  const warnings: Partial<Record<StrategyId, string>> = {};

  const sellingPrice = parseRequiredAmount(baseline.sellingPrice);
  const fields = strategies.fields;

  let revenue = sellingPrice;

  if (strategies.activeIds.includes("bundle_offer")) {
    const rawBundle = fields.bundle_offer.bundlePrice;
    const signed = parseSignedAmount(rawBundle);
    if (signed != null && signed < 0) {
      errors.bundle_offer = BUNDLE_NEGATIVE_MESSAGE;
    } else if (signed != null && revenue != null) {
      revenue = signed;
    }
  }

  for (const strategyId of strategies.activeIds) {
    if (revenue == null) {
      break;
    }

    switch (strategyId) {
      case "discount": {
        if (
          fields.discount.type === "percentage" &&
          isPercentageOver100(fields.discount.value)
        ) {
          errors.discount = PERCENTAGE_OVER_100_MESSAGE;
          break;
        }
        const next = moneyOffWithoutClamp(
          revenue,
          fields.discount.type,
          fields.discount.value,
        );
        if (next != null && next < 0) {
          errors.discount = NEGATIVE_SELLING_PRICE_STRATEGY_MESSAGE;
        } else if (next != null) {
          revenue = next;
        }
        break;
      }
      case "coupon": {
        if (
          fields.coupon.type === "percentage" &&
          isPercentageOver100(fields.coupon.value)
        ) {
          errors.coupon = PERCENTAGE_OVER_100_MESSAGE;
          break;
        }
        const next = moneyOffWithoutClamp(
          revenue,
          fields.coupon.type,
          fields.coupon.value,
        );
        if (next != null && next < 0) {
          errors.coupon = NEGATIVE_SELLING_PRICE_STRATEGY_MESSAGE;
        } else if (next != null) {
          revenue = next;
        }
        break;
      }
      case "flash_sale": {
        if (isPercentageOver100(fields.flash_sale.percentOff)) {
          errors.flash_sale = PERCENTAGE_OVER_100_MESSAGE;
          break;
        }
        const next = percentOffWithoutClamp(
          revenue,
          fields.flash_sale.percentOff,
        );
        if (next != null && next < 0) {
          errors.flash_sale = NEGATIVE_SELLING_PRICE_STRATEGY_MESSAGE;
        } else if (next != null) {
          revenue = next;
        }
        break;
      }
      case "quantity_discount": {
        const minQuantity = parsePositiveInt(
          fields.quantity_discount.minQuantity,
        );
        const simulatedQuantity = parsePositiveInt(
          fields.quantity_discount.simulatedQuantity,
        );
        const discountValue = parseNonNegativeAmount(
          fields.quantity_discount.value,
        );

        if (
          minQuantity == null ||
          discountValue == null ||
          discountValue <= 0 ||
          simulatedQuantity == null
        ) {
          break;
        }

        if (
          fields.quantity_discount.type === "percentage" &&
          isPercentageOver100(fields.quantity_discount.value)
        ) {
          errors.quantity_discount = PERCENTAGE_OVER_100_MESSAGE;
          break;
        }

        if (simulatedQuantity >= minQuantity) {
          const unitRevenue = moneyOffWithoutClamp(
            revenue,
            fields.quantity_discount.type,
            fields.quantity_discount.value,
          );
          if (unitRevenue != null && unitRevenue < 0) {
            errors.quantity_discount = NEGATIVE_SELLING_PRICE_STRATEGY_MESSAGE;
          }
        }
        break;
      }
      case "cashback": {
        const amount = cashbackAmount(
          revenue,
          fields.cashback.type,
          fields.cashback.value,
        );
        if (amount != null && amount > revenue) {
          errors.cashback = CASHBACK_EXCEEDS_MESSAGE;
        }
        break;
      }
      case "free_shipping": {
        if (!fields.free_shipping.enabled) {
          break;
        }
        const shipping = parseNonNegativeAmount(
          fields.free_shipping.shippingCost,
        );
        if (
          shipping != null &&
          shipping > 0 &&
          sellingPrice != null &&
          shipping > sellingPrice
        ) {
          warnings.free_shipping = FREE_SHIPPING_WARNING_MESSAGE;
        }
        break;
      }
      default:
        break;
    }
  }

  return {
    errors,
    warnings,
    hasBlockingError: Object.keys(errors).length > 0,
  };
}
