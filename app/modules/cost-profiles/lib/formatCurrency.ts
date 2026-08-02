/**
 * Format a decimal string as currency for display.
 */
export function formatCurrencyAmount(
  amount: string,
  currency: string,
): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    return amount;
  }

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    return `${currency} ${amount}`;
  }
}

/**
 * Currency symbol or code for input prefix.
 */
export function getCurrencyDisplay(currency: string): string {
  try {
    const parts = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0);

    return parts.find((part) => part.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}
