import { PageLayout } from "~/components/PageLayout";

import {
  TrackedProductList,
  type TrackedProductListItem,
} from "./components/TrackedProductList";
import { useAddTrackedProducts } from "./hooks/useAddTrackedProducts";

export type TrackedProductsPageData = {
  products: TrackedProductListItem[];
};

type ProductsPageProps = {
  data: TrackedProductsPageData;
};

/**
 * Tracked Products Workspace — references only, no Shopify catalog sync.
 */
export function ProductsPage({ data }: ProductsPageProps) {
  const { addProducts, isTracking, trackError, clearTrackError } =
    useAddTrackedProducts();
  const hasProducts = data.products.length > 0;

  return (
    <PageLayout
      title="Tracked Products"
      primaryAction={
        hasProducts ? (
          <s-button
            slot="primary-action"
            variant="primary"
            onClick={addProducts}
            disabled={isTracking}
          >
            Add Products
          </s-button>
        ) : undefined
      }
    >
      {trackError ? (
        <s-banner
          tone="critical"
          heading="Couldn't track products"
          dismissible
          onDismiss={clearTrackError}
        >
          <s-text>{trackError}</s-text>
        </s-banner>
      ) : null}
      <TrackedProductList
        products={data.products}
        onAddProducts={addProducts}
        addProductsDisabled={isTracking}
      />
    </PageLayout>
  );
}
