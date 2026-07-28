import type { ProductVariant } from "./ProductVariant";

export type ProductDetail = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  vendor: string | null;
  productType: string | null;
  tags: string[];
  featuredImageUrl: string | null;
  variants: ProductVariant[];
};
