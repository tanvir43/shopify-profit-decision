import { TrackedProductRow } from "./TrackedProductRow";
import { TrackedProductRowSkeleton } from "./TrackedProductRowSkeleton";
import { TrackedProductsEmptyState } from "./TrackedProductsEmptyState";
import type { TrackedProductWorkspaceItem } from "../types/TrackedProductWorkspaceItem";

type TrackedProductListProps = {
  products: TrackedProductWorkspaceItem[];
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
        <TrackedProductRow key={product.trackedProductId} {...product} />
      ))}
    </s-stack>
  );
}

type TrackedProductListSkeletonProps = {
  count: number;
};

export function TrackedProductListSkeleton({
  count,
}: TrackedProductListSkeletonProps) {
  return (
    <s-stack direction="block" gap="small-100">
      {Array.from({ length: count }, (_, index) => (
        <TrackedProductRowSkeleton key={index} />
      ))}
    </s-stack>
  );
}
