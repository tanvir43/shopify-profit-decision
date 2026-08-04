import {
  COST_ITEM_TYPES,
  COST_ITEM_TYPE_LABELS,
  type CostItemType,
} from "~/modules/cost-profiles/types/CostItemType";

export type CostBreakdownAmounts = Record<CostItemType, string>;
export type CostBreakdownFieldErrors = Partial<Record<CostItemType, string>>;

export type CostBreakdownFormProps = {
  currency: string;
  amounts: CostBreakdownAmounts;
  fieldErrors?: CostBreakdownFieldErrors;
  saveError?: string | null;
  disabled?: boolean;
  onAmountChange: (type: CostItemType, value: string) => void;
};

export function emptyAmounts(): CostBreakdownAmounts {
  return {
    PURCHASE: "",
    PACKAGING: "",
    SHIPPING: "",
    PAYMENT_FEES: "",
    OTHER: "",
  };
}

/**
 * Product Cost Breakdown fields — shared by the dedicated page and workspace modal.
 * Presentation only; validation and persistence stay with the caller.
 */
export function CostBreakdownForm({
  currency,
  amounts,
  fieldErrors = {},
  saveError = null,
  disabled = false,
  onAmountChange,
}: CostBreakdownFormProps) {
  return (
    <s-stack direction="block" gap="large-100">
      {saveError ? (
        <s-banner tone="critical" heading="Could not save">
          <p>{saveError}</p>
        </s-banner>
      ) : null}

      <s-paragraph>
        Break your total cost into individual parts. Leave a field blank if
        you do not know that amount yet.
      </s-paragraph>

      <s-stack direction="block" gap="base">
        {COST_ITEM_TYPES.map((type) => (
          <s-text-field
            key={type}
            label={COST_ITEM_TYPE_LABELS[type]}
            name={type}
            value={amounts[type]}
            prefix={currency}
            disabled={disabled}
            error={fieldErrors[type]}
            onChange={(event: Event) => {
              const target = event.target as HTMLInputElement;
              onAmountChange(type, target.value);
            }}
          />
        ))}
      </s-stack>
    </s-stack>
  );
}
