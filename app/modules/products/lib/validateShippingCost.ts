const MAX_SHIPPING_COST = 999_999.99;

export type ShippingCostValidation =
  | { ok: true; value: string }
  | { ok: false; message: string };

/**
 * Validate Shipping Cost when Free Shipping is enabled.
 * Not required (and not validated) while Free Shipping is unchecked.
 */
export function validateShippingCost(raw: string): ShippingCostValidation {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, message: "Enter a shipping cost." };
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
    return { ok: false, message: "Shipping cost must be greater than zero." };
  }

  if (value > MAX_SHIPPING_COST) {
    return {
      ok: false,
      message: "Shipping cost cannot exceed 999,999.99.",
    };
  }

  return { ok: true, value: value.toFixed(2) };
}
