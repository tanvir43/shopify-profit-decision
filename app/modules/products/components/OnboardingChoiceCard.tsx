type OnboardingChoiceCardProps = {
  title: string;
  description: string;
  buttonLabel: string;
  href: string;
};

/**
 * Single onboarding path — title, description, and one primary CTA.
 */
export function OnboardingChoiceCard({
  title,
  description,
  buttonLabel,
  href,
}: OnboardingChoiceCardProps) {
  return (
    <s-box padding="large-100" borderWidth="base" borderRadius="base">
      <s-stack direction="block" gap="base">
        <s-stack direction="block" gap="small-200">
          <s-heading>{title}</s-heading>
          <s-paragraph>{description}</s-paragraph>
        </s-stack>
        <s-button href={href} variant="primary">
          {buttonLabel}
        </s-button>
      </s-stack>
    </s-box>
  );
}
