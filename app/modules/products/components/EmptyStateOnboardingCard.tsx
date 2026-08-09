const WHY_USE_ITEMS = [
  "Track every product cost",
  "Calculate your true profit",
  "Test pricing strategies",
  "Compare promotional scenarios",
  "Estimate profit before running ads",
] as const;

const GETTING_STARTED_STEPS = [
  "Add a Shopify product",
  "Record your product costs",
  "Set your selling price",
  "Compare pricing and promotional strategies",
  "Choose the most profitable option",
] as const;

/**
 * Educational onboarding for merchants with no tracked products yet (LS-005A).
 * Shown only when the Tracked Products workspace is empty.
 */
export function EmptyStateOnboardingCard() {
  return (
    <s-section accessibilityLabel="Welcome to ProfitPilot">
      <s-box padding="base" borderWidth="base" borderRadius="base">
        <s-stack direction="block" gap="base">
          <s-stack direction="block" gap="small-200">
            <s-heading>Welcome to ProfitPilot</s-heading>
            <s-paragraph>
              ProfitPilot helps you understand the real profit behind every
              product before you spend money on advertising or promotions.
            </s-paragraph>
            <s-paragraph>
              Track every product cost, set a selling price, compare pricing and
              promotional strategies, and instantly see how each decision
              affects your expected profit.
            </s-paragraph>
            <s-paragraph>
              Instead of guessing, make pricing decisions backed by numbers.
            </s-paragraph>
          </s-stack>

          <s-stack direction="block" gap="small-200">
            <s-text type="strong">Why Use ProfitPilot?</s-text>
            <s-stack direction="block" gap="small-100">
              {WHY_USE_ITEMS.map((item) => (
                <s-text key={item}>• {item}</s-text>
              ))}
            </s-stack>
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

          <s-stack direction="block" gap="small-100">
            <s-paragraph>Ready to get started?</s-paragraph>
            <s-paragraph>Scroll down to add your first product.</s-paragraph>
          </s-stack>
        </s-stack>
      </s-box>
    </s-section>
  );
}
