import type { ProductDetail, ProductSummary, ProductVariant } from "../types";

export interface ShopifyProductMapper {
  toProductSummary(shopifyProduct: unknown): ProductSummary;
  toProductDetail(shopifyProduct: unknown): ProductDetail;
  toProductVariant(shopifyVariant: unknown): ProductVariant;
}
