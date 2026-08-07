import type { CSSProperties, ReactNode } from "react";

import { getCurrencyDisplay } from "~/modules/cost-profiles/lib/formatCurrency";

import {
  getStrategyDefinition,
  listLibraryStrategies,
  type StrategyId,
} from "../lib/strategyCatalog";
import type {
  DiscountType,
  StrategyFieldMap,
  StrategyInputs,
} from "../lib/simulateProjectedOutcome";
import {
  addStrategy,
  patchStrategyFields,
  removeStrategy,
} from "../lib/simulateProjectedOutcome";
import { isStrategyActive } from "../lib/strategyActivation";
import { validatePositiveInteger } from "../lib/validatePositiveInteger";
import { validateShippingCost } from "../lib/validateShippingCost";

type StrategyControlsProps = {
  currency: string;
  values: StrategyInputs;
  onChange: (next: StrategyInputs) => void;
  /** When true, strategy cards stay visible but configuration is locked. */
  configurationDisabled?: boolean;
  /** Same action as Product Summary “Edit” Selling Price. */
  onSetSellingPrice?: () => void;
};

const STRATEGY_LIBRARY_MODAL_ID = "strategy-library-modal";

/** Shared width for strategy numeric inputs — consistent across all strategies. */
const NUMERIC_FIELD_MAX_WIDTH = "320px";

/**
 * UI highlight rule: strategy contributes to the current simulation.
 * Quantity Discount also requires a valid customer quantity at/above threshold.
 * Compatibility analysis keeps its own activation rules unchanged.
 */
function isStrategyHighlightActive(
  strategyId: StrategyId,
  fields: StrategyFieldMap,
): boolean {
  if (strategyId === "quantity_discount") {
    const minRaw = fields.quantity_discount.minQuantity.trim();
    const simulatedRaw = fields.quantity_discount.simulatedQuantity.trim();
    const discountRaw = fields.quantity_discount.value.trim();
    if (minRaw === "" || simulatedRaw === "" || discountRaw === "") {
      return false;
    }

    const minQuantity = Number(minRaw);
    const simulatedQuantity = Number(simulatedRaw);
    const discountValue = Number(discountRaw);
    if (
      !Number.isFinite(minQuantity) ||
      !Number.isInteger(minQuantity) ||
      minQuantity <= 0 ||
      !Number.isFinite(simulatedQuantity) ||
      !Number.isInteger(simulatedQuantity) ||
      simulatedQuantity <= 0 ||
      !Number.isFinite(discountValue) ||
      discountValue <= 0
    ) {
      return false;
    }

    return simulatedQuantity >= minQuantity;
  }

  return isStrategyActive(strategyId, fields);
}

function readEventValue(event: Event): string {
  const currentTarget = event.currentTarget as { value?: string } | null;
  if (currentTarget && typeof currentTarget.value === "string") {
    return currentTarget.value;
  }

  const target = event.target as { value?: string } | null;
  return typeof target?.value === "string" ? target.value : "";
}

function readChecked(event: Event): boolean {
  const currentTarget = event.currentTarget as { checked?: boolean } | null;
  if (currentTarget && typeof currentTarget.checked === "boolean") {
    return currentTarget.checked;
  }

  const target = event.target as { checked?: boolean } | null;
  return Boolean(target?.checked);
}

function readChoiceValues(event: Event): string[] {
  const currentTarget = event.currentTarget as { values?: string[] } | null;
  if (currentTarget && Array.isArray(currentTarget.values)) {
    return currentTarget.values;
  }

  return [];
}

type StrategyNumericFieldProps = {
  label: string;
  name: string;
  value: string;
  prefix?: string;
  suffix?: string;
  disabled?: boolean;
  error?: string;
  onValueChange: (value: string) => void;
};

/**
 * Shared numeric strategy input — same width, spacing, and empty behavior.
 * Empty value renders a clean blank field (no placeholder text).
 */
function StrategyNumericField({
  label,
  name,
  value,
  prefix,
  suffix,
  disabled,
  error,
  onValueChange,
}: StrategyNumericFieldProps) {
  return (
    <s-box maxInlineSize={NUMERIC_FIELD_MAX_WIDTH} inlineSize="100%">
      <s-text-field
        label={label}
        name={name}
        value={value}
        prefix={prefix}
        suffix={suffix}
        disabled={disabled}
        error={error}
        autocomplete="off"
        onInput={(event: Event) => {
          onValueChange(readEventValue(event));
        }}
        onChange={(event: Event) => {
          onValueChange(readEventValue(event));
        }}
      />
    </s-box>
  );
}

/** Subtle success treatment for strategies that contribute to the simulation. */
const activeStrategyCardStyle: CSSProperties = {
  padding: "var(--p-space-200, 8px)",
  borderRadius: "var(--p-border-radius-200, 8px)",
  border:
    "var(--p-border-width-025, 1px) solid var(--p-color-border-success, #29845a)",
  background: "var(--p-color-bg-surface-success, #f1f8f5)",
  height: "100%",
  boxSizing: "border-box",
};

const disabledStrategyCardStyle: CSSProperties = {
  opacity: 0.55,
  height: "100%",
};

function StrategyRow({
  title,
  isActive,
  configurationDisabled,
  onRemove,
  children,
}: {
  title: string;
  isActive: boolean;
  configurationDisabled: boolean;
  onRemove: () => void;
  children: ReactNode;
}) {
  const header = (
    <s-stack
      direction="inline"
      gap="small-200"
      alignItems="center"
      justifyContent="space-between"
    >
      <s-stack direction="inline" gap="small-200" alignItems="center">
        <s-text type="strong">{title}</s-text>
        {isActive && !configurationDisabled ? (
          <s-badge tone="success">ACTIVE</s-badge>
        ) : null}
      </s-stack>
      <s-button
        variant="tertiary"
        tone="neutral"
        disabled={configurationDisabled}
        accessibilityLabel={`Remove ${title}`}
        onClick={onRemove}
      >
        Remove
      </s-button>
    </s-stack>
  );

  const body = (
    <s-stack direction="block" gap="small-100">
      {header}
      {children}
    </s-stack>
  );

  if (isActive && !configurationDisabled) {
    return <div style={activeStrategyCardStyle}>{body}</div>;
  }

  const card = (
    <s-box padding="small-100" borderWidth="base" borderRadius="base">
      {body}
    </s-box>
  );

  if (configurationDisabled) {
    return <div style={disabledStrategyCardStyle}>{card}</div>;
  }

  return card;
}

type FieldPatch = <K extends StrategyId>(
  strategyId: K,
  partial: Partial<StrategyFieldMap[K]>,
) => void;

type StrategyControlRenderer = (args: {
  currencyPrefix: string;
  fields: StrategyFieldMap;
  patch: FieldPatch;
  disabled: boolean;
}) => ReactNode;

const STRATEGY_CONTROL_RENDERERS: Record<StrategyId, StrategyControlRenderer> =
  {
    discount: ({ currencyPrefix, fields, patch, disabled }) => (
      <s-stack direction="block" gap="small-100">
        <s-choice-list
          label="Discount Type"
          name="discountType"
          values={[fields.discount.type]}
          disabled={disabled}
          onChange={(event: Event) => {
            if (disabled) {
              return;
            }
            const next = readChoiceValues(event)[0];
            if (next === "percentage" || next === "fixed") {
              patch("discount", { type: next as DiscountType });
            }
          }}
        >
          <s-choice value="percentage">Percentage</s-choice>
          <s-choice value="fixed">Fixed Amount</s-choice>
        </s-choice-list>
        <StrategyNumericField
          label="Discount"
          name="discountValue"
          value={fields.discount.value}
          prefix={fields.discount.type === "fixed" ? currencyPrefix : undefined}
          suffix={fields.discount.type === "percentage" ? "%" : undefined}
          disabled={disabled}
          onValueChange={(value) => {
            patch("discount", { value });
          }}
        />
      </s-stack>
    ),

    free_shipping: ({ currencyPrefix, fields, patch, disabled }) => {
      const enabled = fields.free_shipping.enabled;
      const shippingValidation = enabled
        ? validateShippingCost(fields.free_shipping.shippingCost)
        : null;
      const shippingCostError =
        shippingValidation && !shippingValidation.ok
          ? shippingValidation.message
          : undefined;

      return (
        <s-stack direction="block" gap="small-100">
          <s-checkbox
            label="Offer Free Shipping"
            name="freeShipping"
            checked={enabled}
            disabled={disabled}
            onChange={(event: Event) => {
              if (disabled) {
                return;
              }
              patch("free_shipping", { enabled: readChecked(event) });
            }}
          />
          <StrategyNumericField
            label="Shipping Cost"
            name="shippingCost"
            value={fields.free_shipping.shippingCost}
            prefix={currencyPrefix}
            disabled={disabled || !enabled}
            error={shippingCostError}
            onValueChange={(value) => {
              patch("free_shipping", { shippingCost: value });
            }}
          />
          {enabled ? (
            <s-text color="subdued">
              Deducted from projected profit when Free Shipping is on.
            </s-text>
          ) : null}
        </s-stack>
      );
    },

    bundle_offer: ({ currencyPrefix, fields, patch, disabled }) => (
      <StrategyNumericField
        label="Bundle Price"
        name="bundlePrice"
        value={fields.bundle_offer.bundlePrice}
        prefix={currencyPrefix}
        disabled={disabled}
        onValueChange={(value) => {
          patch("bundle_offer", { bundlePrice: value });
        }}
      />
    ),

    coupon: ({ currencyPrefix, fields, patch, disabled }) => (
      <s-stack direction="block" gap="small-100">
        <s-choice-list
          label="Coupon Type"
          name="couponType"
          values={[fields.coupon.type]}
          disabled={disabled}
          onChange={(event: Event) => {
            if (disabled) {
              return;
            }
            const next = readChoiceValues(event)[0];
            if (next === "percentage" || next === "fixed") {
              patch("coupon", { type: next as DiscountType });
            }
          }}
        >
          <s-choice value="percentage">Percentage</s-choice>
          <s-choice value="fixed">Fixed Amount</s-choice>
        </s-choice-list>
        <StrategyNumericField
          label="Coupon"
          name="couponValue"
          value={fields.coupon.value}
          prefix={fields.coupon.type === "fixed" ? currencyPrefix : undefined}
          suffix={fields.coupon.type === "percentage" ? "%" : undefined}
          disabled={disabled}
          onValueChange={(value) => {
            patch("coupon", { value });
          }}
        />
      </s-stack>
    ),

    cashback: ({ currencyPrefix, fields, patch, disabled }) => (
      <s-stack direction="block" gap="small-100">
        <s-choice-list
          label="Cashback Type"
          name="cashbackType"
          values={[fields.cashback.type]}
          disabled={disabled}
          onChange={(event: Event) => {
            if (disabled) {
              return;
            }
            const next = readChoiceValues(event)[0];
            if (next === "percentage" || next === "fixed") {
              patch("cashback", { type: next as DiscountType });
            }
          }}
        >
          <s-choice value="percentage">Percentage</s-choice>
          <s-choice value="fixed">Fixed Amount</s-choice>
        </s-choice-list>
        <StrategyNumericField
          label="Cashback"
          name="cashbackValue"
          value={fields.cashback.value}
          prefix={fields.cashback.type === "fixed" ? currencyPrefix : undefined}
          suffix={fields.cashback.type === "percentage" ? "%" : undefined}
          disabled={disabled}
          onValueChange={(value) => {
            patch("cashback", { value });
          }}
        />
      </s-stack>
    ),

    buy_x_get_y: ({ fields, patch, disabled }) => (
      <s-stack direction="inline" gap="small-200">
        <StrategyNumericField
          label="Buy"
          name="buyQty"
          value={fields.buy_x_get_y.buyQty}
          disabled={disabled}
          onValueChange={(value) => {
            patch("buy_x_get_y", { buyQty: value });
          }}
        />
        <StrategyNumericField
          label="Get Free"
          name="getQty"
          value={fields.buy_x_get_y.getQty}
          disabled={disabled}
          onValueChange={(value) => {
            patch("buy_x_get_y", { getQty: value });
          }}
        />
      </s-stack>
    ),

    flash_sale: ({ fields, patch, disabled }) => (
      <StrategyNumericField
        label="Percent Off"
        name="flashSalePercent"
        value={fields.flash_sale.percentOff}
        suffix="%"
        disabled={disabled}
        onValueChange={(value) => {
          patch("flash_sale", { percentOff: value });
        }}
      />
    ),

    referral_bonus: ({ currencyPrefix, fields, patch, disabled }) => (
      <StrategyNumericField
        label="Bonus Amount"
        name="referralBonus"
        value={fields.referral_bonus.amount}
        prefix={currencyPrefix}
        disabled={disabled}
        onValueChange={(value) => {
          patch("referral_bonus", { amount: value });
        }}
      />
    ),

    quantity_discount: ({ currencyPrefix, fields, patch, disabled }) => {
      const discountEntered = fields.quantity_discount.value.trim() !== "";
      const minQuantityValidation =
        discountEntered || fields.quantity_discount.minQuantity.trim()
          ? validatePositiveInteger(
              fields.quantity_discount.minQuantity,
              "Apply when customer buys at least",
            )
          : null;
      const simulatedQuantityValidation =
        discountEntered || fields.quantity_discount.simulatedQuantity.trim()
          ? validatePositiveInteger(
              fields.quantity_discount.simulatedQuantity,
              "Customer buys",
            )
          : null;

      return (
        <s-stack direction="block" gap="small-100">
          <StrategyNumericField
            label="Apply when customer buys at least"
            name="quantityDiscountMinQuantity"
            value={fields.quantity_discount.minQuantity}
            suffix="items"
            disabled={disabled}
            error={
              minQuantityValidation && !minQuantityValidation.ok
                ? minQuantityValidation.message
                : undefined
            }
            onValueChange={(value) => {
              patch("quantity_discount", { minQuantity: value });
            }}
          />
          <s-choice-list
            label="Discount Type"
            name="quantityDiscountType"
            values={[fields.quantity_discount.type]}
            disabled={disabled}
            onChange={(event: Event) => {
              if (disabled) {
                return;
              }
              const next = readChoiceValues(event)[0];
              if (next === "percentage" || next === "fixed") {
                patch("quantity_discount", { type: next as DiscountType });
              }
            }}
          >
            <s-choice value="percentage">Percentage</s-choice>
            <s-choice value="fixed">Fixed Amount</s-choice>
          </s-choice-list>
          <StrategyNumericField
            label="Discount"
            name="quantityDiscountValue"
            value={fields.quantity_discount.value}
            prefix={
              fields.quantity_discount.type === "fixed"
                ? currencyPrefix
                : undefined
            }
            suffix={
              fields.quantity_discount.type === "percentage" ? "%" : undefined
            }
            disabled={disabled}
            onValueChange={(value) => {
              patch("quantity_discount", { value });
            }}
          />
          <s-stack direction="block" gap="small-100">
            <s-text type="strong">Simulation</s-text>
            <StrategyNumericField
              label="Customer buys"
              name="quantityDiscountSimulatedQuantity"
              value={fields.quantity_discount.simulatedQuantity}
              suffix="items"
              disabled={disabled}
              error={
                simulatedQuantityValidation && !simulatedQuantityValidation.ok
                  ? simulatedQuantityValidation.message
                  : undefined
              }
              onValueChange={(value) => {
                patch("quantity_discount", { simulatedQuantity: value });
              }}
            />
          </s-stack>
        </s-stack>
      );
    },

    gift_with_purchase: ({ currencyPrefix, fields, patch, disabled }) => (
      <StrategyNumericField
        label="Gift Cost"
        name="giftCost"
        value={fields.gift_with_purchase.giftCost}
        prefix={currencyPrefix}
        disabled={disabled}
        onValueChange={(value) => {
          patch("gift_with_purchase", { giftCost: value });
        }}
      />
    ),

    loyalty_reward: ({ fields, patch, disabled }) => (
      <StrategyNumericField
        label="Reward Percent"
        name="loyaltyPercent"
        value={fields.loyalty_reward.percent}
        suffix="%"
        disabled={disabled}
        onValueChange={(value) => {
          patch("loyalty_reward", { percent: value });
        }}
      />
    ),
  };

/**
 * Always-visible strategy controls. Activation is implied by the controls
 * themselves — no Configure / Apply / Save. Rendering is registry-driven so
 * new predefined strategies can be added without redesigning the page.
 * When Selling Price is missing, cards stay visible but configuration is locked.
 */
export function StrategyControls({
  currency,
  values,
  onChange,
  configurationDisabled = false,
  onSetSellingPrice,
}: StrategyControlsProps) {
  const currencyPrefix = getCurrencyDisplay(currency);
  const patch: FieldPatch = (strategyId, partial) => {
    if (configurationDisabled) {
      return;
    }
    onChange(patchStrategyFields(values, strategyId, partial));
  };

  const libraryStrategies = listLibraryStrategies(values.activeIds);

  return (
    <s-stack direction="block" gap="small-100">
      {configurationDisabled ? (
        <s-box padding="base" borderWidth="base" borderRadius="base">
          <s-stack direction="block" gap="base">
            <s-stack direction="block" gap="small-100">
              <s-text type="strong">
                Please set a Selling Price before configuring pricing or
                promotional strategies.
              </s-text>
              <s-paragraph color="subdued">
                Your selling price is required to accurately calculate profit
                and evaluate strategy performance.
              </s-paragraph>
            </s-stack>
            <s-button variant="primary" onClick={onSetSellingPrice}>
              Set Selling Price
            </s-button>
          </s-stack>
        </s-box>
      ) : null}

      <s-grid
        gap="small-100"
        gridTemplateColumns="repeat(auto-fit, minmax(280px, 1fr))"
      >
        {values.activeIds.map((strategyId) => {
          const definition = getStrategyDefinition(strategyId);
          const renderControls = STRATEGY_CONTROL_RENDERERS[strategyId];
          const active = isStrategyHighlightActive(strategyId, values.fields);

          return (
            <StrategyRow
              key={strategyId}
              title={definition.label}
              isActive={active}
              configurationDisabled={configurationDisabled}
              onRemove={() => {
                if (configurationDisabled) {
                  return;
                }
                onChange(removeStrategy(values, strategyId));
              }}
            >
              {renderControls({
                currencyPrefix,
                fields: values.fields,
                patch,
                disabled: configurationDisabled,
              })}
            </StrategyRow>
          );
        })}
      </s-grid>

      <s-button
        variant="secondary"
        disabled={configurationDisabled}
        commandFor={STRATEGY_LIBRARY_MODAL_ID}
        command="--show"
      >
        Add Strategy
      </s-button>

      <s-modal
        id={STRATEGY_LIBRARY_MODAL_ID}
        heading="Strategy Library"
        size="base"
      >
        <s-stack direction="block" gap="small-200">
          <s-paragraph color="subdued">
            Choose a strategy to add to this simulation.
          </s-paragraph>

          {libraryStrategies.length === 0 ? (
            <s-text color="subdued">
              All available strategies are already in this simulation.
            </s-text>
          ) : (
            libraryStrategies.map((strategy) => (
              <s-box
                key={strategy.id}
                padding="small-100"
                borderWidth="base"
                borderRadius="base"
              >
                <s-stack
                  direction="inline"
                  gap="base"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <s-stack direction="block" gap="none">
                    <s-text type="strong">{strategy.label}</s-text>
                    <s-text color="subdued">{strategy.description}</s-text>
                  </s-stack>
                  <s-button
                    variant="primary"
                    disabled={configurationDisabled}
                    commandFor={STRATEGY_LIBRARY_MODAL_ID}
                    command="--hide"
                    onClick={() => {
                      if (configurationDisabled) {
                        return;
                      }
                      onChange(addStrategy(values, strategy.id));
                    }}
                  >
                    Add
                  </s-button>
                </s-stack>
              </s-box>
            ))
          )}
        </s-stack>

        <s-button
          slot="secondary-actions"
          variant="secondary"
          commandFor={STRATEGY_LIBRARY_MODAL_ID}
          command="--hide"
        >
          Close
        </s-button>
      </s-modal>
    </s-stack>
  );
}
