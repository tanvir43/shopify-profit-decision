import { useCallback, useState, type Ref } from "react";

import { formatCurrencyAmount } from "~/modules/cost-profiles/lib/formatCurrency";

import { calculateSuggestedSellingPrice } from "../lib/calculateSuggestedSellingPrice";
import { validateTargetMargin } from "../lib/validateTargetMargin";

export type SellingPricePricingMethod = "manual" | "margin";

type SellingPriceMethodFieldsProps = {
  currency: string;
  totalCost: string | null;
  pricingMethod: SellingPricePricingMethod;
  onPricingMethodChange: (method: SellingPricePricingMethod) => void;
  sellingPriceValue: string;
  sellingPriceError?: string;
  disabled?: boolean;
  sellingPriceInputRef?: Ref<HTMLElement | null>;
  onSellingPriceInput: (event: Event) => void;
  /** Called after a valid suggested price is applied; parent should store it and switch to manual. */
  onSuggestedPriceApplied: (suggestedPrice: string) => void;
};

function readEventValue(event: Event): string {
  const currentTarget = event.currentTarget as { value?: string } | null;
  if (currentTarget && typeof currentTarget.value === "string") {
    return currentTarget.value;
  }

  const target = event.target as { value?: string } | null;
  return typeof target?.value === "string" ? target.value : "";
}

function readChoiceValues(event: Event): string[] {
  const currentTarget = event.currentTarget as { values?: string[] } | null;
  if (currentTarget && Array.isArray(currentTarget.values)) {
    return currentTarget.values;
  }

  return [];
}

/**
 * Shared manual / margin pricing method UI for selling price setup (PP-0016 / PP-0016.1).
 */
export function SellingPriceMethodFields({
  currency,
  totalCost,
  pricingMethod,
  onPricingMethodChange,
  sellingPriceValue,
  sellingPriceError,
  disabled = false,
  sellingPriceInputRef,
  onSellingPriceInput,
  onSuggestedPriceApplied,
}: SellingPriceMethodFieldsProps) {
  const [targetMargin, setTargetMargin] = useState("");
  const [marginError, setMarginError] = useState<string | null>(null);

  const marginValidation = validateTargetMargin(targetMargin);
  const suggestedSellingPrice = marginValidation.ok
    ? calculateSuggestedSellingPrice(totalCost, marginValidation.value)
    : null;

  const suggestedDisplay =
    suggestedSellingPrice != null
      ? formatCurrencyAmount(suggestedSellingPrice, currency)
      : "—";

  const handlePricingMethodChange = useCallback(
    (event: Event) => {
      const next = readChoiceValues(event)[0];
      if (next === "manual" || next === "margin") {
        onPricingMethodChange(next);
        setMarginError(null);
      }
    },
    [onPricingMethodChange],
  );

  const handleMarginInput = useCallback((event: Event) => {
    setTargetMargin(readEventValue(event));
    setMarginError(null);
  }, []);

  const handleUseSuggestedPrice = useCallback(() => {
    const result = validateTargetMargin(targetMargin);
    if (!result.ok) {
      setMarginError(result.message);
      return;
    }

    const suggested = calculateSuggestedSellingPrice(totalCost, result.value);
    if (suggested == null) {
      setMarginError("Product cost is required to calculate a selling price.");
      return;
    }

    setMarginError(null);
    onSuggestedPriceApplied(suggested);
    onPricingMethodChange("manual");
  }, [onPricingMethodChange, onSuggestedPriceApplied, targetMargin, totalCost]);

  return (
    <s-stack direction="block" gap="base">
      <s-choice-list
        label="How would you like to set your selling price?"
        name="pricingMethod"
        values={[pricingMethod]}
        onChange={handlePricingMethodChange}
      >
        <s-choice value="manual">I already know my selling price</s-choice>
        <s-choice value="margin">
          Calculate it from my target profit margin
        </s-choice>
      </s-choice-list>

      {pricingMethod === "manual" ? (
        <s-text-field
          ref={sellingPriceInputRef as never}
          label="Selling Price"
          name="sellingPrice"
          value={sellingPriceValue}
          prefix={currency}
          disabled={disabled}
          error={sellingPriceError}
          onInput={onSellingPriceInput}
          onChange={onSellingPriceInput}
        />
      ) : (
        <s-stack direction="block" gap="base">
          <s-text-field
            label="Target Profit Margin"
            name="targetMargin"
            value={targetMargin}
            suffix="%"
            disabled={disabled}
            error={
              marginError ??
              (targetMargin.trim().length > 0 && !marginValidation.ok
                ? marginValidation.message
                : undefined)
            }
            onInput={handleMarginInput}
            onChange={handleMarginInput}
          />

          <s-stack direction="block" gap="small-200">
            <s-text color="subdued">Suggested Selling Price</s-text>
            <s-text type="strong">{suggestedDisplay}</s-text>
          </s-stack>

          {targetMargin.trim().length > 0 ? (
            <s-button
              variant="secondary"
              disabled={disabled || suggestedSellingPrice == null}
              onClick={handleUseSuggestedPrice}
            >
              Use Suggested Selling Price
            </s-button>
          ) : null}
        </s-stack>
      )}
    </s-stack>
  );
}
