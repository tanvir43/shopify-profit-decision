import { PageLayout } from "~/components/PageLayout";

import {
  CostItemsEmptyState,
  CostItemsList,
  type CostItemListEntry,
} from "./components";

export type CostProfileStatus = "configured" | "not_configured";

export type CostProfilePageData = {
  productId: string;
  currency: string;
  status: CostProfileStatus;
  totalCostItems: number;
  activeCostItems: number;
  items: CostItemListEntry[];
};

type CostProfilePageProps = {
  profile: CostProfilePageData;
};

/**
 * Merchant-facing Cost Profile surface (PP-0008).
 *
 * Answers three questions only: which product, are costs configured,
 * what should I do next. No money math, no inline editing.
 */
export function CostProfilePage({ profile }: CostProfilePageProps) {
  const isConfigured = profile.status === "configured";
  const hasItems = profile.items.length > 0;

  const primaryAction = hasItems ? (
    <s-button slot="primary-action" variant="primary">
      Manage Cost Items
    </s-button>
  ) : undefined;

  return (
    <PageLayout title="Cost Profile" primaryAction={primaryAction}>
      <s-stack direction="block" gap="base">
        <HeaderSection profile={profile} isConfigured={isConfigured} />
        <SummarySection
          totalCostItems={profile.totalCostItems}
          activeCostItems={profile.activeCostItems}
        />
        <CostItemsSection hasItems={hasItems} items={profile.items} />
      </s-stack>
    </PageLayout>
  );
}

function HeaderSection({
  profile,
  isConfigured,
}: {
  profile: CostProfilePageData;
  isConfigured: boolean;
}) {
  return (
    <s-section heading="Product">
      <s-stack direction="block" gap="base">
        <s-stack
          direction="inline"
          gap="base"
          justifyContent="space-between"
          alignItems="center"
        >
          <s-stack direction="block" gap="small-100">
            <s-text color="subdued">Product</s-text>
            <s-text type="strong">{profile.productId}</s-text>
          </s-stack>
          {isConfigured ? (
            <s-badge tone="success">Configured</s-badge>
          ) : (
            <s-badge tone="caution">Not Configured</s-badge>
          )}
        </s-stack>
        <s-stack direction="block" gap="small-100">
          <s-text color="subdued">Currency</s-text>
          <s-text type="strong">{profile.currency}</s-text>
        </s-stack>
      </s-stack>
    </s-section>
  );
}

function SummarySection({
  totalCostItems,
  activeCostItems,
}: {
  totalCostItems: number;
  activeCostItems: number;
}) {
  return (
    <s-section heading="Summary">
      <s-stack direction="inline" gap="large-100">
        <s-stack direction="block" gap="small-100">
          <s-text color="subdued">Total Cost Items</s-text>
          <s-text type="strong" fontVariantNumeric="tabular-nums">
            {totalCostItems}
          </s-text>
        </s-stack>
        <s-stack direction="block" gap="small-100">
          <s-text color="subdued">Active Cost Items</s-text>
          <s-text type="strong" fontVariantNumeric="tabular-nums">
            {activeCostItems}
          </s-text>
        </s-stack>
      </s-stack>
    </s-section>
  );
}

function CostItemsSection({
  hasItems,
  items,
}: {
  hasItems: boolean;
  items: CostItemListEntry[];
}) {
  if (!hasItems) {
    return <CostItemsEmptyState />;
  }

  return (
    <s-section heading="Cost Items">
      <CostItemsList items={items} />
    </s-section>
  );
}
