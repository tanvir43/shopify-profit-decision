import { Suspense } from "react";
import { Await } from "react-router";

import { PageLayout } from "~/components/PageLayout";

import { EmptyStateOnboardingCard } from "./components/EmptyStateOnboardingCard";
import {
  TrackedProductList,
  TrackedProductListSkeleton,
} from "./components/TrackedProductList";
import { useAddTrackedProducts } from "./hooks/useAddTrackedProducts";
import type { TrackedProductWorkspaceData } from "./services/trackedProductWorkspace.server";

export type TrackedProductsPageData = {
  trackedCount: number;
  workspace: Promise<TrackedProductWorkspaceData>;
};

type ProductsPageProps = {
  data: TrackedProductsPageData;
};

type WorkspaceContentProps = {
  workspace: TrackedProductWorkspaceData;
  onAddProducts: () => void;
  addProductsDisabled: boolean;
};

function WorkspaceContent({
  workspace,
  onAddProducts,
  addProductsDisabled,
}: WorkspaceContentProps) {
  return (
    <>
      {workspace.enrichmentError ? (
        <s-banner tone="warning" heading="Product details unavailable">
          <s-text>{workspace.enrichmentError}</s-text>
        </s-banner>
      ) : null}
      <TrackedProductList
        products={workspace.items}
        onAddProducts={onAddProducts}
        addProductsDisabled={addProductsDisabled}
      />
    </>
  );
}

/**
 * Tracked Products Workspace — references enriched at runtime from Shopify.
 */
export function ProductsPage({ data }: ProductsPageProps) {
  const { addProducts, isTracking, trackError, clearTrackError } =
    useAddTrackedProducts();
  const hasProducts = data.trackedCount > 0;

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
      {hasProducts ? (
        <Suspense
          fallback={
            <TrackedProductListSkeleton count={data.trackedCount} />
          }
        >
          <Await resolve={data.workspace}>
            {(workspace) => (
              <WorkspaceContent
                workspace={workspace}
                onAddProducts={addProducts}
                addProductsDisabled={isTracking}
              />
            )}
          </Await>
        </Suspense>
      ) : (
        <s-stack direction="block" gap="base">
          <EmptyStateOnboardingCard />
          <TrackedProductList
            products={[]}
            onAddProducts={addProducts}
            addProductsDisabled={isTracking}
          />
        </s-stack>
      )}
    </PageLayout>
  );
}
