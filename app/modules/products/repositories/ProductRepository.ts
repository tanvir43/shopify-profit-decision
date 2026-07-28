import type { ProductDetail, ProductSummary } from "../types";

export interface ProductRepository {
  getProducts(): Promise<ProductSummary[]>;
  getProduct(id: string): Promise<ProductDetail | null>;
  syncProduct(id: string): Promise<ProductDetail>;
}
