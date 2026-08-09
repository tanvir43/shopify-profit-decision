const MAX_AMOUNT = 999_999.99;

export type DetailedSetupAmountValidation =
  | { ok: true; value: string | null }
  | { ok: false; message: string };

/**
 * Validate an optional Detailed Setup amount.
 * Empty / whitespace → not provided (null).
 * Provided values must be >= 0 with up to two decimal places.
 */
export function validateDetailedSetupAmount(
  raw: string,
): DetailedSetupAmountValidation {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: true, value: null };
  }

  const normalized = trimmed.replace(/,/g, "");
  if (normalized.startsWith("-")) {
    return { ok: false, message: "Product cost cannot be negative." };
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return {
      ok: false,
      message: "Enter a valid amount with up to two decimal places.",
    };
  }

  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) {
    return { ok: false, message: "Product cost cannot be negative." };
  }

  if (value > MAX_AMOUNT) {
    return { ok: false, message: "Amount cannot exceed 999,999.99." };
  }

  return { ok: true, value: value.toFixed(2) };
}
