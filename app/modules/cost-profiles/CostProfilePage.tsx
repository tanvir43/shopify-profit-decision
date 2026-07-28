import { PageLayout } from "~/components/PageLayout";

export type CostProfilePageData = {
  productId: string;
  currency: string;
  costItemCount: number;
  notes: string | null;
};

type CostProfilePageProps = {
  profile: CostProfilePageData;
};

/**
 * Read-only Cost Profile surface.
 * Editing UI is intentionally out of scope (PP-0007).
 */
export function CostProfilePage({ profile }: CostProfilePageProps) {
  return (
    <PageLayout title="Cost Profile">
      <s-section>
        <s-stack direction="block" gap="base">
          <s-paragraph>
            <s-text type="strong">Product ID</s-text>
            <br />
            {profile.productId}
          </s-paragraph>
          <s-paragraph>
            <s-text type="strong">Currency</s-text>
            <br />
            {profile.currency}
          </s-paragraph>
          <s-paragraph>
            <s-text type="strong">Cost Items</s-text>
            <br />
            {profile.costItemCount}
          </s-paragraph>
          {profile.notes ? (
            <s-paragraph>
              <s-text type="strong">Notes</s-text>
              <br />
              {profile.notes}
            </s-paragraph>
          ) : null}
        </s-stack>
      </s-section>
    </PageLayout>
  );
}
