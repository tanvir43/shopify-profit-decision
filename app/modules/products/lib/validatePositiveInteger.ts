export type PositiveIntegerValidation =
  | { ok: true; value: number }
  | { ok: false; message: string };

/**
 * Validate a required positive integer (min 1).
 * Used by Quantity Discount threshold and simulation quantity fields.
 */
export function validatePositiveInteger(
  raw: string,
  label: string,
): PositiveIntegerValidation {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, message: `${label} is required.` };
  }

  const normalized = trimmed.replace(/,/g, "");
  if (!/^\d+$/.test(normalized)) {
    return { ok: false, message: `${label} must be a whole number.` };
  }

  const value = Number(normalized);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
    return { ok: false, message: `${label} must be at least 1.` };
  }

  return { ok: true, value };
}
