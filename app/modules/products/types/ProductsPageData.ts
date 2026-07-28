import type { ProductSummary } from "./ProductSummary";

export type ProductsPageInfo = {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
};

export type ProductsPageData = {
  products: ProductSummary[];
  pageInfo: ProductsPageInfo;
};
