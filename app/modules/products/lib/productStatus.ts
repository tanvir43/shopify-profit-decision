export type ProductStatusLabel =
  | "Active"
  | "Draft"
  | "Archived"
  | "Unavailable"
  | "Unknown";

export type ProductStatusTone = "success" | "caution" | "neutral";

export function formatProductStatus(
  status: string,
): { label: ProductStatusLabel; tone: ProductStatusTone } {
  switch (status) {
    case "ACTIVE":
      return { label: "Active", tone: "success" };
    case "DRAFT":
      return { label: "Draft", tone: "caution" };
    case "ARCHIVED":
      return { label: "Archived", tone: "neutral" };
    case "UNAVAILABLE":
      return { label: "Unavailable", tone: "neutral" };
    case "UNKNOWN":
      return { label: "Unknown", tone: "neutral" };
    default:
      return { label: "Draft", tone: "neutral" };
  }
}

export function isTrackedProductUnavailable(status: string): boolean {
  return status === "UNAVAILABLE";
}

export function costProfileHref(productId: string): string {
  return `/app/products/${encodeURIComponent(productId)}/cost-profile`;
}

export function trackedProductHref(trackedProductId: string): string {
  return `/app/products/${encodeURIComponent(trackedProductId)}`;
}

export function quickStartHref(trackedProductId: string): string {
  return `/app/products/${encodeURIComponent(trackedProductId)}/quick-start`;
}

export function detailedSetupHref(trackedProductId: string): string {
  return `/app/products/${encodeURIComponent(trackedProductId)}/detailed-setup`;
}

export function sellingPriceHref(trackedProductId: string): string {
  return `/app/products/${encodeURIComponent(trackedProductId)}/selling-price`;
}
