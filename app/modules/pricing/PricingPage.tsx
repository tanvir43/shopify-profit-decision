import { useCallback } from "react";
import { useNavigation, useSubmit } from "react-router";

import { PageLayout } from "~/components/PageLayout";

export function PricingPage() {
  const submit = useSubmit();
  const navigation = useNavigation();
  const isManagingPlan =
    navigation.state !== "idle" && navigation.formMethod === "POST";

  const handleManagePlan = useCallback(() => {
    if (isManagingPlan) {
      return;
    }

    submit(null, { method: "post" });
  }, [isManagingPlan, submit]);

  return (
    <PageLayout
      title="Pricing"
      primaryAction={
        <s-button
          slot="primary-action"
          variant="primary"
          disabled={isManagingPlan}
          loading={isManagingPlan}
          onClick={handleManagePlan}
        >
          Manage plan
        </s-button>
      }
    >
      <s-stack direction="block" gap="base">
        <s-paragraph>
          Manage your ProfitPilot subscription through Shopify.
        </s-paragraph>
        <s-paragraph color="subdued">
          Plan changes, billing, and subscription management are securely
          handled by Shopify.
        </s-paragraph>
      </s-stack>
    </PageLayout>
  );
}
