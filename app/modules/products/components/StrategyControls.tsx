import type { ReactNode } from "react";

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
import { validateShippingCost } from "../lib/validateShippingCost";

type StrategyControlsProps = {
  currency: string;
  values: StrategyInputs;
  onChange: (next: StrategyInputs) => void;
};

const STRATEGY_LIBRARY_MODAL_ID = "strategy-library-modal";

/** Shared width for strategy numeric inputs — consistent across all strategies. */
const NUMERIC_FIELD_MAX_WIDTH = "320px";

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

function StrategyRow({
  title,
  onRemove,
  children,
}: {
  title: string;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <s-box padding="small-100" borderWidth="base" borderRadius="base">
      <s-stack direction="block" gap="small-100">
        <s-stack
          direction="inline"
          gap="small-200"
          alignItems="center"
          justifyContent="space-between"
        >
          <s-text type="strong">{title}</s-text>
          <s-button
            variant="tertiary"
            tone="neutral"
            accessibilityLabel={`Remove ${title}`}
            onClick={onRemove}
          >
            Remove
          </s-button>
        </s-stack>
        {children}
      </s-stack>
    </s-box>
  );
}

type FieldPatch = <K extends StrategyId>(
  strategyId: K,
  partial: Partial<StrategyFieldMap[K]>,
) => void;

type StrategyControlRenderer = (args: {
  currencyPrefix: string;
  fields: StrategyFieldMap;
  patch: FieldPatch;
}) => ReactNode;

const STRATEGY_CONTROL_RENDERERS: Record<StrategyId, StrategyControlRenderer> =
  {
    discount: ({ currencyPrefix, fields, patch }) => (
      <s-stack direction="block" gap="small-100">
        <s-choice-list
          label="Discount Type"
          name="discountType"
          values={[fields.discount.type]}
          onChange={(event: Event) => {
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
          onValueChange={(value) => {
            patch("discount", { value });
          }}
        />
      </s-stack>
    ),

    free_shipping: ({ currencyPrefix, fields, patch }) => {
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
            onChange={(event: Event) => {
              patch("free_shipping", { enabled: readChecked(event) });
            }}
          />
          <StrategyNumericField
            label="Shipping Cost"
            name="shippingCost"
            value={fields.free_shipping.shippingCost}
            prefix={currencyPrefix}
            disabled={!enabled}
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

    bundle_offer: ({ currencyPrefix, fields, patch }) => (
      <StrategyNumericField
        label="Bundle Price"
        name="bundlePrice"
        value={fields.bundle_offer.bundlePrice}
        prefix={currencyPrefix}
        onValueChange={(value) => {
          patch("bundle_offer", { bundlePrice: value });
        }}
      />
    ),

    coupon: ({ currencyPrefix, fields, patch }) => (
      <s-stack direction="block" gap="small-100">
        <s-choice-list
          label="Coupon Type"
          name="couponType"
          values={[fields.coupon.type]}
          onChange={(event: Event) => {
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
          onValueChange={(value) => {
            patch("coupon", { value });
          }}
        />
      </s-stack>
    ),

    cashback: ({ currencyPrefix, fields, patch }) => (
      <s-stack direction="block" gap="small-100">
        <s-choice-list
          label="Cashback Type"
          name="cashbackType"
          values={[fields.cashback.type]}
          onChange={(event: Event) => {
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
          onValueChange={(value) => {
            patch("cashback", { value });
          }}
        />
      </s-stack>
    ),

    buy_x_get_y: ({ fields, patch }) => (
      <s-stack direction="inline" gap="small-200">
        <StrategyNumericField
          label="Buy"
          name="buyQty"
          value={fields.buy_x_get_y.buyQty}
          onValueChange={(value) => {
            patch("buy_x_get_y", { buyQty: value });
          }}
        />
        <StrategyNumericField
          label="Get Free"
          name="getQty"
          value={fields.buy_x_get_y.getQty}
          onValueChange={(value) => {
            patch("buy_x_get_y", { getQty: value });
          }}
        />
      </s-stack>
    ),

    flash_sale: ({ fields, patch }) => (
      <StrategyNumericField
        label="Percent Off"
        name="flashSalePercent"
        value={fields.flash_sale.percentOff}
        suffix="%"
        onValueChange={(value) => {
          patch("flash_sale", { percentOff: value });
        }}
      />
    ),

    referral_bonus: ({ currencyPrefix, fields, patch }) => (
      <StrategyNumericField
        label="Bonus Amount"
        name="referralBonus"
        value={fields.referral_bonus.amount}
        prefix={currencyPrefix}
        onValueChange={(value) => {
          patch("referral_bonus", { amount: value });
        }}
      />
    ),

    quantity_discount: ({ fields, patch }) => (
      <StrategyNumericField
        label="Percent Off"
        name="quantityDiscountPercent"
        value={fields.quantity_discount.percentOff}
        suffix="%"
        onValueChange={(value) => {
          patch("quantity_discount", { percentOff: value });
        }}
      />
    ),

    gift_with_purchase: ({ currencyPrefix, fields, patch }) => (
      <StrategyNumericField
        label="Gift Cost"
        name="giftCost"
        value={fields.gift_with_purchase.giftCost}
        prefix={currencyPrefix}
        onValueChange={(value) => {
          patch("gift_with_purchase", { giftCost: value });
        }}
      />
    ),

    loyalty_reward: ({ fields, patch }) => (
      <StrategyNumericField
        label="Reward Percent"
        name="loyaltyPercent"
        value={fields.loyalty_reward.percent}
        suffix="%"
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
 */
export function StrategyControls({
  currency,
  values,
  onChange,
}: StrategyControlsProps) {
  const currencyPrefix = getCurrencyDisplay(currency);
  const patch: FieldPatch = (strategyId, partial) => {
    onChange(patchStrategyFields(values, strategyId, partial));
  };

  const libraryStrategies = listLibraryStrategies(values.activeIds);

  return (
    <s-stack direction="block" gap="small-100">
      {values.activeIds.map((strategyId) => {
        const definition = getStrategyDefinition(strategyId);
        const renderControls = STRATEGY_CONTROL_RENDERERS[strategyId];

        return (
          <StrategyRow
            key={strategyId}
            title={definition.label}
            onRemove={() => {
              onChange(removeStrategy(values, strategyId));
            }}
          >
            {renderControls({
              currencyPrefix,
              fields: values.fields,
              patch,
            })}
          </StrategyRow>
        );
      })}

      <s-button
        variant="secondary"
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
                    commandFor={STRATEGY_LIBRARY_MODAL_ID}
                    command="--hide"
                    onClick={() => {
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
