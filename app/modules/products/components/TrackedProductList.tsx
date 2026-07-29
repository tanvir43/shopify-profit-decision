import { TrackedProductRow } from "./TrackedProductRow";
import { TrackedProductsEmptyState } from "./TrackedProductsEmptyState";

export type TrackedProductListItem = {
  id: string;
  shopifyProductId: string;
  trackedAt: string;
};

type TrackedProductListProps = {
  products: TrackedProductListItem[];
  onAddProducts: () => void;
  addProductsDisabled?: boolean;
};

export function TrackedProductList({
  products,
  onAddProducts,
  addProductsDisabled = false,
}: TrackedProductListProps) {
  if (products.length === 0) {
    return (
      <TrackedProductsEmptyState
        onAddProducts={onAddProducts}
        addProductsDisabled={addProductsDisabled}
      />
    );
  }

  return (
    <s-stack direction="block" gap="small-100">
      {products.map((product) => (
        <TrackedProductRow
          key={product.id}
          id={product.id}
          shopifyProductId={product.shopifyProductId}
          trackedAt={product.trackedAt}
        />
      ))}
    </s-stack>
  );
}
