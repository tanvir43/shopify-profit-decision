export type TargetMarginValidation =
  | { ok: true; value: number }
  | { ok: false; message: string };

/**
 * Validate a target profit margin percentage for suggested selling price.
 * Must be numeric, greater than 0, and less than 100.
 */
export function validateTargetMargin(raw: string): TargetMarginValidation {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, message: "Enter a target profit margin." };
  }

  const normalized = trimmed.replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return { ok: false, message: "Margin must be a number." };
  }

  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0 || value >= 100) {
    return { ok: false, message: "Margin must be between 0 and 100%." };
  }

  return { ok: true, value };
}
