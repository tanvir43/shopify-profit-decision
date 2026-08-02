import type { ReactNode } from "react";

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
    <s-box padding="small" borderWidth="base" borderRadius="base">
      <s-stack direction="block" gap="small-200">
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
  currency: string;
  fields: StrategyFieldMap;
  patch: FieldPatch;
}) => ReactNode;

const STRATEGY_CONTROL_RENDERERS: Record<StrategyId, StrategyControlRenderer> =
  {
    discount: ({ currency, fields, patch }) => (
      <s-stack direction="block" gap="small-200">
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
        <s-text-field
          label="Discount Value"
          name="discountValue"
          value={fields.discount.value}
          prefix={fields.discount.type === "fixed" ? currency : undefined}
          suffix={fields.discount.type === "percentage" ? "%" : undefined}
          onInput={(event: Event) => {
            patch("discount", { value: readEventValue(event) });
          }}
          onChange={(event: Event) => {
            patch("discount", { value: readEventValue(event) });
          }}
        />
      </s-stack>
    ),

    free_shipping: ({ currency, fields, patch }) => {
      const enabled = fields.free_shipping.enabled;
      const shippingValidation = enabled
        ? validateShippingCost(fields.free_shipping.shippingCost)
        : null;
      const shippingCostError =
        shippingValidation && !shippingValidation.ok
          ? shippingValidation.message
          : undefined;

      return (
        <s-stack direction="block" gap="small-200">
          <s-checkbox
            label="Offer Free Shipping"
            name="freeShipping"
            checked={enabled}
            onChange={(event: Event) => {
              patch("free_shipping", { enabled: readChecked(event) });
            }}
          />
          <s-text-field
            label="Shipping Cost"
            name="shippingCost"
            value={fields.free_shipping.shippingCost}
            prefix={currency}
            disabled={!enabled}
            error={shippingCostError}
            onInput={(event: Event) => {
              patch("free_shipping", { shippingCost: readEventValue(event) });
            }}
            onChange={(event: Event) => {
              patch("free_shipping", { shippingCost: readEventValue(event) });
            }}
          />
          <s-text color="subdued">
            This amount will be deducted from your projected profit when Free
            Shipping is enabled.
          </s-text>
        </s-stack>
      );
    },

    bundle_offer: ({ currency, fields, patch }) => (
      <s-text-field
        label="Bundle Price"
        name="bundlePrice"
        value={fields.bundle_offer.bundlePrice}
        prefix={currency}
        onInput={(event: Event) => {
          patch("bundle_offer", { bundlePrice: readEventValue(event) });
        }}
        onChange={(event: Event) => {
          patch("bundle_offer", { bundlePrice: readEventValue(event) });
        }}
      />
    ),

    coupon: ({ currency, fields, patch }) => (
      <s-stack direction="block" gap="small-200">
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
        <s-text-field
          label="Coupon Value"
          name="couponValue"
          value={fields.coupon.value}
          prefix={fields.coupon.type === "fixed" ? currency : undefined}
          suffix={fields.coupon.type === "percentage" ? "%" : undefined}
          onInput={(event: Event) => {
            patch("coupon", { value: readEventValue(event) });
          }}
          onChange={(event: Event) => {
            patch("coupon", { value: readEventValue(event) });
          }}
        />
      </s-stack>
    ),

    cashback: ({ currency, fields, patch }) => (
      <s-stack direction="block" gap="small-200">
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
        <s-text-field
          label="Cashback Value"
          name="cashbackValue"
          value={fields.cashback.value}
          prefix={fields.cashback.type === "fixed" ? currency : undefined}
          suffix={fields.cashback.type === "percentage" ? "%" : undefined}
          onInput={(event: Event) => {
            patch("cashback", { value: readEventValue(event) });
          }}
          onChange={(event: Event) => {
            patch("cashback", { value: readEventValue(event) });
          }}
        />
      </s-stack>
    ),

    buy_x_get_y: ({ fields, patch }) => (
      <s-stack direction="inline" gap="small-200">
        <s-text-field
          label="Buy"
          name="buyQty"
          value={fields.buy_x_get_y.buyQty}
          onInput={(event: Event) => {
            patch("buy_x_get_y", { buyQty: readEventValue(event) });
          }}
          onChange={(event: Event) => {
            patch("buy_x_get_y", { buyQty: readEventValue(event) });
          }}
        />
        <s-text-field
          label="Get Free"
          name="getQty"
          value={fields.buy_x_get_y.getQty}
          onInput={(event: Event) => {
            patch("buy_x_get_y", { getQty: readEventValue(event) });
          }}
          onChange={(event: Event) => {
            patch("buy_x_get_y", { getQty: readEventValue(event) });
          }}
        />
      </s-stack>
    ),

    flash_sale: ({ fields, patch }) => (
      <s-text-field
        label="Percent Off"
        name="flashSalePercent"
        value={fields.flash_sale.percentOff}
        suffix="%"
        onInput={(event: Event) => {
          patch("flash_sale", { percentOff: readEventValue(event) });
        }}
        onChange={(event: Event) => {
          patch("flash_sale", { percentOff: readEventValue(event) });
        }}
      />
    ),

    referral_bonus: ({ currency, fields, patch }) => (
      <s-text-field
        label="Bonus Amount"
        name="referralBonus"
        value={fields.referral_bonus.amount}
        prefix={currency}
        onInput={(event: Event) => {
          patch("referral_bonus", { amount: readEventValue(event) });
        }}
        onChange={(event: Event) => {
          patch("referral_bonus", { amount: readEventValue(event) });
        }}
      />
    ),

    quantity_discount: ({ fields, patch }) => (
      <s-text-field
        label="Percent Off"
        name="quantityDiscountPercent"
        value={fields.quantity_discount.percentOff}
        suffix="%"
        onInput={(event: Event) => {
          patch("quantity_discount", { percentOff: readEventValue(event) });
        }}
        onChange={(event: Event) => {
          patch("quantity_discount", { percentOff: readEventValue(event) });
        }}
      />
    ),

    gift_with_purchase: ({ currency, fields, patch }) => (
      <s-text-field
        label="Gift Cost"
        name="giftCost"
        value={fields.gift_with_purchase.giftCost}
        prefix={currency}
        onInput={(event: Event) => {
          patch("gift_with_purchase", { giftCost: readEventValue(event) });
        }}
        onChange={(event: Event) => {
          patch("gift_with_purchase", { giftCost: readEventValue(event) });
        }}
      />
    ),

    loyalty_reward: ({ fields, patch }) => (
      <s-text-field
        label="Reward Percent"
        name="loyaltyPercent"
        value={fields.loyalty_reward.percent}
        suffix="%"
        onInput={(event: Event) => {
          patch("loyalty_reward", { percent: readEventValue(event) });
        }}
        onChange={(event: Event) => {
          patch("loyalty_reward", { percent: readEventValue(event) });
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
  const patch: FieldPatch = (strategyId, partial) => {
    onChange(patchStrategyFields(values, strategyId, partial));
  };

  const libraryStrategies = listLibraryStrategies(values.activeIds);

  return (
    <s-stack direction="block" gap="small-200">
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
            {renderControls({ currency, fields: values.fields, patch })}
          </StrategyRow>
        );
      })}

      <s-button
        variant="secondary"
        commandFor={STRATEGY_LIBRARY_MODAL_ID}
        command="--show"
      >
        + Add Strategy
      </s-button>

      <s-modal
        id={STRATEGY_LIBRARY_MODAL_ID}
        heading="Strategy Library"
        size="base"
      >
        <s-stack direction="block" gap="small-200">
          <s-paragraph>
            Choose a predefined business decision strategy to add to this
            simulation.
          </s-paragraph>

          {libraryStrategies.length === 0 ? (
            <s-text color="subdued">
              All available strategies are already in this simulation.
            </s-text>
          ) : (
            libraryStrategies.map((strategy) => (
              <s-box
                key={strategy.id}
                padding="small"
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
