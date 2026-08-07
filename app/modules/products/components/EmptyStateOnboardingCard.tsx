type EmptyStateOnboardingCardProps = {
  onAddProducts: () => void;
  addProductsDisabled?: boolean;
};

const GETTING_STARTED_STEPS = [
  "Add a product to track",
  "Enter your product costs",
  "Set your selling price",
  "Simulate pricing and promotional strategies",
  "Review your estimated profit",
] as const;

/**
 * Educational onboarding for merchants with no tracked products yet (LS-005A).
 * Shown only when the Tracked Products workspace is empty.
 */
export function EmptyStateOnboardingCard({
  onAddProducts,
  addProductsDisabled = false,
}: EmptyStateOnboardingCardProps) {
  return (
    <s-section accessibilityLabel="Welcome to ProfitPilot">
      <s-box padding="base" borderWidth="base" borderRadius="base">
        <s-stack direction="block" gap="base">
          <s-stack direction="block" gap="small-200">
            <s-heading>Welcome to ProfitPilot</s-heading>
            <s-text color="subdued">
              Understand your product&apos;s profitability before investing in
              advertising.
            </s-text>
            <s-paragraph>
              ProfitPilot helps you organize product costs, set a selling price,
              simulate common pricing and promotional strategies, and estimate
              your expected profit before making business decisions.
            </s-paragraph>
          </s-stack>

          <s-stack direction="block" gap="small-200">
            <s-text type="strong">Getting Started</s-text>
            <s-stack direction="block" gap="small-100">
              {GETTING_STARTED_STEPS.map((step, index) => (
                <s-text key={step}>
                  {index + 1}. {step}
                </s-text>
              ))}
            </s-stack>
          </s-stack>

          <s-button-group>
            <s-button
              slot="primary-action"
              variant="primary"
              onClick={onAddProducts}
              disabled={addProductsDisabled}
            >
              Add Your First Product
            </s-button>
          </s-button-group>
        </s-stack>
      </s-box>
    </s-section>
  );
}
