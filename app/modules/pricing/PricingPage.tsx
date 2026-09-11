import { useSubmit } from "react-router";

import { PageLayout } from "~/components/PageLayout";

export function PricingPage() {
  const submit = useSubmit();

  return (
    <PageLayout
      title="Pricing"
      primaryAction={
        <s-button
          slot="primary-action"
          variant="primary"
          onClick={() => submit(null, { method: "post" })}
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
