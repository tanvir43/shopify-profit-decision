const MAX_SELLING_PRICE = 999_999.99;

export type SellingPriceValidation =
  | { ok: true; value: string }
  | { ok: false; message: string };

/**
 * Validate a selling price input (client or server).
 * Returns a normalized decimal string with two fractional digits on success.
 */
export function validateSellingPrice(raw: string): SellingPriceValidation {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, message: "Enter a selling price." };
  }

  const normalized = trimmed.replace(/,/g, "");
  if (normalized.startsWith("-")) {
    return { ok: false, message: "Selling price cannot be negative." };
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return {
      ok: false,
      message: "Enter a valid amount with up to two decimal places.",
    };
  }

  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, message: "Selling price must be greater than zero." };
  }

  if (value > MAX_SELLING_PRICE) {
    return {
      ok: false,
      message: "Selling price cannot exceed 999,999.99.",
    };
  }

  return { ok: true, value: value.toFixed(2) };
}
