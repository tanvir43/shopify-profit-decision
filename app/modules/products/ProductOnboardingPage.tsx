import { PageLayout } from "~/components/PageLayout";

import { AdvancedSetupModal, ADVANCED_SETUP_MODAL_ID } from "./components/AdvancedSetupModal";
import { OnboardingChoiceCard } from "./components/OnboardingChoiceCard";
import { QuickStartModal, QUICK_START_MODAL_ID } from "./components/QuickStartModal";
import { trackedProductsListHref } from "./lib/productStatus";

export type ProductOnboardingPageData = {
  trackedProductId: string;
  currency: string;
  totalCost: string | null;
};

type ProductOnboardingPageProps = {
  data: ProductOnboardingPageData;
};

/**
 * First-time cost profile onboarding — one decision, two equal paths (PP-0011).
 * Cost entry opens in modals so merchants skip a full route loader round-trip.
 */
export function ProductOnboardingPage({ data }: ProductOnboardingPageProps) {
  const { trackedProductId, currency, totalCost } = data;
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
            commandFor={QUICK_START_MODAL_ID}
          />
          <OnboardingChoiceCard
            title="I want a detailed breakdown"
            description="Build a complete cost profile using individual cost components."
            buttonLabel="Advanced Setup"
            commandFor={ADVANCED_SETUP_MODAL_ID}
          />
        </s-grid>
      </s-stack>

      <QuickStartModal
        trackedProductId={trackedProductId}
        currency={currency}
        initialTotalCost={totalCost}
      />
      <AdvancedSetupModal
        trackedProductId={trackedProductId}
        currency={currency}
      />
    </PageLayout>
  );
}
