import type { ProductVariant } from "./ProductVariant";

/**
 * UI-only view model for the Tracked Products Workspace.
 * Built at runtime from TrackedProduct refs + Shopify enrichment — never persisted.
 */
export type TrackedProductWorkspaceItem = {
  trackedProductId: string;
  shopifyProductId: string;
  title: string;
  status: string;
  imageUrl: string | null;
  imageAlt: string | null;
  trackedAt: string;
  /** True when a product cost is saved — Decision Workspace / simulation ready. */
  hasProductCost: boolean;
  variants: Pick<ProductVariant, "id" | "title" | "price">[];
};
