type OnboardingChoiceCardProps = {
  title: string;
  description: string;
  buttonLabel: string;
  /** Opens a modal via Polaris commandFor (preferred for instant open). */
  commandFor?: string;
  command?: "--show" | "--auto" | "--hide" | "--toggle" | "--copy";
  /** Fallback navigation when a dedicated page is still used. */
  href?: string;
};

/**
 * Single onboarding path — title, description, and one primary CTA.
 */
export function OnboardingChoiceCard({
  title,
  description,
  buttonLabel,
  commandFor,
  command = "--show",
  href,
}: OnboardingChoiceCardProps) {
  return (
    <s-box padding="large-100" borderWidth="base" borderRadius="base">
      <s-stack direction="block" gap="base">
        <s-stack direction="block" gap="small-200">
          <s-heading>{title}</s-heading>
          <s-paragraph>{description}</s-paragraph>
        </s-stack>
        {commandFor ? (
          <s-button
            variant="primary"
            commandFor={commandFor}
            command={command}
          >
            {buttonLabel}
          </s-button>
        ) : (
          <s-button href={href} variant="primary">
            {buttonLabel}
          </s-button>
        )}
      </s-stack>
    </s-box>
  );
}
