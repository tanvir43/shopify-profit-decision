const MAX_TOTAL_COST = 999_999.99;

export type QuickStartTotalCostValidation =
  | { ok: true; value: string }
  | { ok: false; message: string };

/**
 * Validate a Quick Start total cost input (client or server).
 * Returns a normalized decimal string with two fractional digits on success.
 */
export function validateQuickStartTotalCost(
  raw: string,
): QuickStartTotalCostValidation {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, message: "Enter a total product cost." };
  }

  const normalized = trimmed.replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return {
      ok: false,
      message: "Enter a valid amount with up to two decimal places.",
    };
  }

  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, message: "Total cost must be greater than zero." };
  }

  if (value > MAX_TOTAL_COST) {
    return { ok: false, message: "Total cost cannot exceed 999,999.99." };
  }

  return { ok: true, value: value.toFixed(2) };
}
