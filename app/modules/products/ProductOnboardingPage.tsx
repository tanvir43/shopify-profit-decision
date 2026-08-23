import { PageLayout } from "~/components/PageLayout";

import { OnboardingChoiceCard } from "./components/OnboardingChoiceCard";
import {
  detailedSetupHref,
  quickStartHref,
  trackedProductsListHref,
} from "./lib/productStatus";

export type ProductOnboardingPageData = {
  trackedProductId: string;
};

type ProductOnboardingPageProps = {
  data: ProductOnboardingPageData;
};

/**
 * First-time cost profile onboarding — one decision, two equal paths (PP-0011).
 * No forms, no cost inputs, no persistence.
 */
export function ProductOnboardingPage({ data }: ProductOnboardingPageProps) {
  const { trackedProductId } = data;
  const backHref = trackedProductsListHref(trackedProductId);

  return (
    <PageLayout
      title="How would you like to get started?"
      breadcrumbActions={
        <s-link slot="breadcrumb-actions" href={backHref}>
          Back
        </s-link>
      }
    >
      <s-stack direction="block" gap="large-100">
        <s-paragraph>
          Choose the approach that best matches how you currently manage your
          product costs.
        </s-paragraph>

        <s-grid
          gap="base"
          gridTemplateColumns="repeat(auto-fit, minmax(280px, 1fr))"
        >
          <OnboardingChoiceCard
            title="I already know my total cost"
            description="Start quickly with a single total cost. You can add a detailed breakdown later."
            buttonLabel="Quick Start"
            href={quickStartHref(trackedProductId)}
          />
          <OnboardingChoiceCard
            title="I want a detailed breakdown"
            description="Build a complete cost profile using individual cost components."
            buttonLabel="Advanced Setup"
            href={detailedSetupHref(trackedProductId)}
          />
        </s-grid>
      </s-stack>
    </PageLayout>
  );
}
