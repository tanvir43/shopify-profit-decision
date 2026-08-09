import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

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
  /** When false, strategy edits stay local and are not applied to the simulation. */
  sellingPriceReady: boolean;
  /** Same action as Product Summary “Edit” Selling Price. */
  onSetSellingPrice: () => void;
  /** Business-rule field errors that block simulation updates. */
  fieldErrors?: Partial<Record<StrategyId, string>>;
  /** Business-rule warnings that never block simulation. */
  fieldWarnings?: Partial<Record<StrategyId, string>>;
};

const STRATEGY_LIBRARY_MODAL_ID = "strategy-library-modal";
const SELLING_PRICE_REQUIRED_MODAL_ID = "selling-price-required-modal";

type ModalElement = HTMLElement & {
  showOverlay: () => void;
  hideOverlay: () => void;
};

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

/** Inactive card chrome — same wrapper element as active to avoid input remount. */
const inactiveStrategyCardStyle: CSSProperties = {
  padding: "var(--p-space-100, 4px)",
  borderRadius: "var(--p-border-radius-200, 8px)",
  border: "var(--p-border-width-025, 1px) solid var(--p-color-border, #c9cccf)",
  height: "100%",
  boxSizing: "border-box",
};

function StrategyRow({
  title,
  isActive,
  onRemove,
  children,
}: {
  title: string;
  isActive: boolean;
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
        {isActive ? <s-badge tone="success">ACTIVE</s-badge> : null}
      </s-stack>
      <s-button
        variant="tertiary"
        tone="neutral"
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

  // Stable outer element: swapping s-box ↔ div on isActive remounted inputs and stole focus.
  return (
    <div style={isActive ? activeStrategyCardStyle : inactiveStrategyCardStyle}>
      {body}
    </div>
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
  fieldError?: string;
  fieldWarning?: string;
}) => ReactNode;

const STRATEGY_CONTROL_RENDERERS: Record<StrategyId, StrategyControlRenderer> =
  {
    discount: ({ currencyPrefix, fields, patch, fieldError }) => (
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
          error={fieldError}
          onValueChange={(value) => {
            patch("discount", { value });
          }}
        />
      </s-stack>
    ),

    free_shipping: ({
      currencyPrefix,
      fields,
      patch,
      fieldWarning,
    }) => {
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
          {enabled && fieldWarning ? (
            <s-banner tone="warning">{fieldWarning}</s-banner>
          ) : null}
        </s-stack>
      );
    },

    bundle_offer: ({ currencyPrefix, fields, patch, fieldError }) => (
      <StrategyNumericField
        label="Bundle Price"
        name="bundlePrice"
        value={fields.bundle_offer.bundlePrice}
        prefix={currencyPrefix}
        error={fieldError}
        onValueChange={(value) => {
          patch("bundle_offer", { bundlePrice: value });
        }}
      />
    ),

    coupon: ({ currencyPrefix, fields, patch, fieldError }) => (
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
          error={fieldError}
          onValueChange={(value) => {
            patch("coupon", { value });
          }}
        />
      </s-stack>
    ),

    cashback: ({ currencyPrefix, fields, patch, fieldError }) => (
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
          error={fieldError}
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

    flash_sale: ({ fields, patch, fieldError }) => (
      <StrategyNumericField
        label="Percent Off"
        name="flashSalePercent"
        value={fields.flash_sale.percentOff}
        suffix="%"
        error={fieldError}
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

    quantity_discount: ({ currencyPrefix, fields, patch, fieldError }) => {
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
            onChange={(event: Event) => {
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
            error={fieldError}
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
 *
 * LS-005B: merchants may browse and enter values without a Selling Price, but
 * those edits are not applied to the live simulation until a valid price exists.
 */
export function StrategyControls({
  currency,
  values,
  onChange,
  sellingPriceReady,
  onSetSellingPrice,
  fieldErrors,
  fieldWarnings,
}: StrategyControlsProps) {
  const currencyPrefix = getCurrencyDisplay(currency);
  const [draft, setDraft] = useState<StrategyInputs | null>(null);
  const modalRef = useRef<ModalElement | null>(null);
  const modalOpenRef = useRef(false);
  const wasSellingPriceReady = useRef(sellingPriceReady);

  const displayValues =
    !sellingPriceReady && draft != null ? draft : values;

  useEffect(() => {
    const becameReady = sellingPriceReady && !wasSellingPriceReady.current;
    wasSellingPriceReady.current = sellingPriceReady;

    if (!becameReady || draft == null) {
      return;
    }

    onChange(draft);
    setDraft(null);
  }, [sellingPriceReady, draft, onChange]);

  const commitChange = (next: StrategyInputs) => {
    if (!sellingPriceReady) {
      setDraft(next);
      if (!modalOpenRef.current) {
        modalRef.current?.showOverlay();
      }
      return;
    }

    onChange(next);
  };

  const patch: FieldPatch = (strategyId, partial) => {
    commitChange(patchStrategyFields(displayValues, strategyId, partial));
  };

  const libraryStrategies = listLibraryStrategies(displayValues.activeIds);

  return (
    <s-stack direction="block" gap="small-100">
      <s-grid
        gap="small-100"
        gridTemplateColumns="repeat(auto-fit, minmax(280px, 1fr))"
      >
        {displayValues.activeIds.map((strategyId) => {
          const definition = getStrategyDefinition(strategyId);
          const renderControls = STRATEGY_CONTROL_RENDERERS[strategyId];
          const active = isStrategyHighlightActive(
            strategyId,
            displayValues.fields,
          );

          return (
            <StrategyRow
              key={strategyId}
              title={definition.label}
              isActive={active}
              onRemove={() => {
                commitChange(removeStrategy(displayValues, strategyId));
              }}
            >
              {renderControls({
                currencyPrefix,
                fields: displayValues.fields,
                patch,
                fieldError: fieldErrors?.[strategyId],
                fieldWarning: fieldWarnings?.[strategyId],
              })}
            </StrategyRow>
          );
        })}
      </s-grid>

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
                      commitChange(addStrategy(displayValues, strategy.id));
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

      <s-modal
        id={SELLING_PRICE_REQUIRED_MODAL_ID}
        heading="Selling Price Required"
        size="base"
        ref={modalRef as never}
        onShow={() => {
          modalOpenRef.current = true;
        }}
        onHide={() => {
          modalOpenRef.current = false;
        }}
      >
        <s-stack direction="block" gap="small-100">
          <s-paragraph>
            Please set a Selling Price before saving pricing or promotional
            strategies.
          </s-paragraph>
          <s-paragraph color="subdued">
            Your selling price is required to accurately calculate profit and
            evaluate strategy performance.
          </s-paragraph>
        </s-stack>

        <s-button
          slot="primary-action"
          variant="primary"
          onClick={() => {
            modalRef.current?.hideOverlay();
            onSetSellingPrice();
          }}
        >
          Set Selling Price
        </s-button>
        <s-button
          slot="secondary-actions"
          variant="secondary"
          commandFor={SELLING_PRICE_REQUIRED_MODAL_ID}
          command="--hide"
        >
          Close
        </s-button>
      </s-modal>
    </s-stack>
  );
}
