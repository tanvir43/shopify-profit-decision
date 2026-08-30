import type { CSSProperties } from "react";

const WHY_USE_FEATURES = [
  {
    icon: "product-cost",
    accent: "#2c6ecb",
    background: "#f1f8ff",
    title: "Track every product cost",
    description:
      "Record total or itemized costs so profit starts from your real numbers.",
  },
  {
    icon: "cash-dollar",
    accent: "#008060",
    background: "#f1f8f5",
    title: "Calculate your true profit",
    description:
      "See margin and profit after costs — not just revenue from Shopify.",
  },
  {
    icon: "chart-line",
    accent: "#5c6ac4",
    background: "#f4f5fa",
    title: "Test pricing strategies",
    description:
      "Try different price points and see how each one affects expected profit.",
  },
  {
    icon: "discount",
    accent: "#b98900",
    background: "#fffbf2",
    title: "Compare promotional scenarios",
    description:
      "Model discounts, bundles, and offers before you launch them live.",
  },
  {
    icon: "megaphone",
    accent: "#d82c0d",
    background: "#fff4f4",
    title: "Estimate profit before running ads",
    description:
      "Know whether a product is worth promoting before you spend on ads.",
  },
] as const;

const GETTING_STARTED_STEPS = [
  "Add a Shopify product",
  "Record your product costs",
  "Set your selling price",
  "Compare pricing and promotional strategies",
  "Choose the most profitable option",
] as const;

const heroBannerStyle: CSSProperties = {
  borderRadius: "12px",
  overflow: "hidden",
};

const featuresSectionStyle: CSSProperties = {
  border: "1px solid var(--p-color-border, #e3e3e3)",
  borderRadius: "12px",
  padding: "20px",
  background: "var(--p-color-bg-surface, #ffffff)",
};

const featuresGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "16px",
};

const stepsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
};

type FeatureCardProps = {
  icon: (typeof WHY_USE_FEATURES)[number]["icon"];
  accent: string;
  background: string;
  title: string;
  description: string;
};

function FeatureCard({
  icon,
  accent,
  background,
  title,
  description,
}: FeatureCardProps) {
  const cardStyle: CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    gap: "14px",
    padding: "16px",
    borderRadius: "10px",
    border: "1px solid var(--p-color-border-secondary, #ebebeb)",
    borderLeft: `4px solid ${accent}`,
    background,
    minHeight: "112px",
  };

  const iconShellStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "44px",
    height: "44px",
    borderRadius: "10px",
    background: "var(--p-color-bg-surface, #ffffff)",
    boxShadow: "0 1px 0 rgba(22, 29, 37, 0.05)",
    flexShrink: 0,
    color: accent,
  };

  return (
    <div style={cardStyle}>
      <div style={iconShellStyle}>
        <s-icon type={icon} size="base" />
      </div>
      <s-stack direction="block" gap="small-100">
        <s-text type="strong">{title}</s-text>
        <s-paragraph color="subdued">{description}</s-paragraph>
      </s-stack>
    </div>
  );
}

type StepCardProps = {
  step: number;
  label: string;
};

function StepCard({ step, label }: StepCardProps) {
  const cardStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px 14px",
    borderRadius: "10px",
    border: "1px solid var(--p-color-border, #e3e3e3)",
    background: "var(--p-color-bg-surface-secondary, #f6f6f7)",
  };

  const numberStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    borderRadius: "999px",
    background: "var(--p-color-bg-fill-info, #2c6ecb)",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: 600,
    flexShrink: 0,
  };

  return (
    <div style={cardStyle}>
      <span style={numberStyle}>{step}</span>
      <s-text>{label}</s-text>
    </div>
  );
}

type EmptyStateOnboardingCardProps = {
  onAddProducts?: () => void;
  addProductsDisabled?: boolean;
};

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
      <s-stack direction="block" gap="large-100">
        <s-stack direction="block" gap="small-200">
          <s-heading>Welcome to ProfitPilot</s-heading>
          <s-paragraph color="subdued">
            ProfitPilot helps you understand the real profit behind every
            product before you spend money on advertising or promotions.
          </s-paragraph>
        </s-stack>

        <div style={heroBannerStyle}>
          <s-banner tone="info" heading="Price with confidence, not guesswork">
            <s-stack direction="block" gap="small-100">
              <s-paragraph>
                Track every product cost, set a selling price, compare pricing
                and promotional strategies, and instantly see how each decision
                affects your expected profit.
              </s-paragraph>
              <s-text type="strong">
                Instead of guessing, make pricing decisions backed by your real
                numbers.
              </s-text>
            </s-stack>
          </s-banner>
        </div>

        <div style={featuresSectionStyle}>
          <s-stack direction="block" gap="base">
            <s-stack direction="block" gap="small-100">
              <s-heading>Why Use ProfitPilot?</s-heading>
              <s-paragraph color="subdued">
                Five core capabilities to help you protect margin and grow
                profit.
              </s-paragraph>
            </s-stack>

            <div style={featuresGridStyle}>
              {WHY_USE_FEATURES.map((feature) => (
                <FeatureCard
                  key={feature.title}
                  icon={feature.icon}
                  accent={feature.accent}
                  background={feature.background}
                  title={feature.title}
                  description={feature.description}
                />
              ))}
            </div>
          </s-stack>
        </div>

        <s-box padding="large-100" borderWidth="base" borderRadius="base">
          <s-stack direction="block" gap="base">
            <s-stack direction="block" gap="small-100">
              <s-heading>Getting Started</s-heading>
              <s-paragraph color="subdued">
                Follow these five steps to run your first profit simulation.
              </s-paragraph>
            </s-stack>
            <div style={stepsGridStyle}>
              {GETTING_STARTED_STEPS.map((step, index) => (
                <StepCard key={step} step={index + 1} label={step} />
              ))}
            </div>
          </s-stack>
        </s-box>

        <s-box padding="large-100" borderWidth="base" borderRadius="base">
          <s-stack
            direction="inline"
            gap="base"
            alignItems="center"
            justifyContent="space-between"
          >
            <s-stack direction="block" gap="small-100">
              <s-text type="strong">Ready to get started?</s-text>
              <s-paragraph color="subdued">
                Add your first Shopify product to begin building your profit
                workspace.
              </s-paragraph>
            </s-stack>
            {onAddProducts ? (
              <s-button
                variant="primary"
                onClick={onAddProducts}
                disabled={addProductsDisabled}
              >
                Add Your First Product
              </s-button>
            ) : null}
          </s-stack>
        </s-box>
      </s-stack>
    </s-section>
  );
}
