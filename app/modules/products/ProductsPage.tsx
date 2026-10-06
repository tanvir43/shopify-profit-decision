import { Suspense, type ReactNode } from "react";
import { Await, Link } from "react-router";

import { PageLayout } from "~/components/PageLayout";

import { EmptyStateOnboardingCard } from "./components/EmptyStateOnboardingCard";
import { SavedComparisonsList } from "./components/SavedComparisonsList";
import {
  TrackedProductList,
  TrackedProductListSkeleton,
} from "./components/TrackedProductList";
import {
  ALREADY_TRACKED_MESSAGE,
  useAddTrackedProducts,
} from "./hooks/useAddTrackedProducts";
import type { SavedComparisonSummary } from "./lib/savedComparisons";
import type { TrackedProductWorkspaceData } from "./services/trackedProductWorkspace.server";

export type TrackedProductUsageSummary = {
  currentCount: number;
  limit: number | null;
  isUnlimited: boolean;
  planDisplayName: string;
};

export type TrackedProductsPageData = {
  trackedCount: number;
  trackedShopifyProductIds: string[];
  productUsage: TrackedProductUsageSummary;
  savedComparisons: SavedComparisonSummary[];
  workspace: Promise<TrackedProductWorkspaceData>;
};

function TrackedProductUsageIndicator({
  usage,
}: {
  usage: TrackedProductUsageSummary;
}) {
  const remainingCount =
    usage.limit === null ? null : Math.max(0, usage.limit - usage.currentCount);

  return (
    <s-stack direction="block" gap="small-100">
      <s-text type="strong">Tracked products</s-text>
      <s-text color="subdued">
        {usage.isUnlimited
          ? `${usage.currentCount} used · Unlimited plan`
          : `${usage.currentCount} of ${usage.limit} used · ${remainingCount} available`}
      </s-text>
    </s-stack>
  );
}

type ProductsPageProps = {
  data: TrackedProductsPageData;
};

type WorkspaceContentProps = {
  workspace: TrackedProductWorkspaceData;
  onAddProducts: () => void;
  addProductsDisabled: boolean;
  contentBeforeList: ReactNode;
  savedComparisons: SavedComparisonSummary[];
};

function WorkspaceContent({
  workspace,
  onAddProducts,
  addProductsDisabled,
  contentBeforeList,
  savedComparisons,
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
        contentBeforeList={
          <>
            {contentBeforeList}
            <SavedComparisonsList comparisons={savedComparisons} />
          </>
        }
      />
    </>
  );
}

/**
 * Tracked Products Workspace — references enriched at runtime from Shopify.
 */
export function ProductsPage({ data }: ProductsPageProps) {
  const {
    addProducts,
    isTracking,
    trackError,
    trackErrorCode,
    clearTrackError,
  } = useAddTrackedProducts({
    trackedShopifyProductIds: data.trackedShopifyProductIds,
  });
  const hasProducts = data.trackedCount > 0;

  const isLimitError = trackErrorCode === "TRACKED_PRODUCT_LIMIT_EXCEEDED";
  const isAtLimit =
    data.productUsage.limit !== null &&
    data.productUsage.currentCount >= data.productUsage.limit;

  const trackErrorHeading = isLimitError
    ? "Tracked product limit reached"
    : trackError === ALREADY_TRACKED_MESSAGE
      ? "Product already tracked"
      : "Couldn't track products";

  const usageSummary = (
    <s-stack direction="block" gap="base">
      <TrackedProductUsageIndicator usage={data.productUsage} />
      {isAtLimit ? (
        <s-banner
          tone="warning"
          heading={`You've reached your ${data.productUsage.planDisplayName} plan limit of ${data.productUsage.limit} tracked products.`}
        >
          <Link to="/app/pricing">
            <s-button>Manage plan</s-button>
          </Link>
        </s-banner>
      ) : null}
    </s-stack>
  );

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
            loading={isTracking}
          >
            Add Products
          </s-button>
        ) : undefined
      }
    >
      {trackError ? (
        <s-banner
          tone={trackError === ALREADY_TRACKED_MESSAGE ? "warning" : "critical"}
          heading={trackErrorHeading}
          dismissible
          onDismiss={clearTrackError}
        >
          <s-stack direction="block" gap="small">
            <s-text>{trackError}</s-text>
            {isLimitError && !isAtLimit ? (
              <Link to="/app/pricing">
                <s-button variant="primary">Manage plan</s-button>
              </Link>
            ) : null}
          </s-stack>
        </s-banner>
      ) : null}
      {hasProducts ? (
        <Suspense
          fallback={<TrackedProductListSkeleton count={data.trackedCount} />}
        >
          <Await resolve={data.workspace}>
            {(workspace) => (
              <WorkspaceContent
                workspace={workspace}
                onAddProducts={addProducts}
                addProductsDisabled={isTracking}
                contentBeforeList={usageSummary}
                savedComparisons={data.savedComparisons}
              />
            )}
          </Await>
        </Suspense>
      ) : (
        <s-stack direction="block" gap="base">
          {usageSummary}
          <SavedComparisonsList comparisons={data.savedComparisons} />
          <EmptyStateOnboardingCard
            onAddProducts={addProducts}
            addProductsDisabled={isTracking}
          />
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
