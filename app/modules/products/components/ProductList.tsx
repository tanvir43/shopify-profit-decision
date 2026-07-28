import type { ProductsPageData } from "../types";

import { ProductListEmptyState } from "./ProductListEmptyState";
import { ProductRow } from "./ProductRow";
import { ProductsPagination } from "./ProductsPagination";

type ProductListProps = {
  data: ProductsPageData;
};

export function ProductList({ data }: ProductListProps) {
  if (data.products.length === 0) {
    return <ProductListEmptyState />;
  }

  return (
    <s-stack direction="block" gap="base">
      <s-stack direction="block" gap="small-100">
        {data.products.map((product) => (
          <ProductRow key={product.id} product={product} />
        ))}
      </s-stack>
      <ProductsPagination pageInfo={data.pageInfo} />
    </s-stack>
  );
}
