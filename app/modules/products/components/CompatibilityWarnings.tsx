import type { CompatibilityWarning } from "../lib/strategyCompatibility";

type CompatibilityWarningsProps = {
  warnings: CompatibilityWarning[];
};

function bannerTone(
  severity: CompatibilityWarning["severity"],
): "warning" | "info" {
  return severity === "recommendation" ? "info" : "warning";
}

function severityLabel(
  severity: CompatibilityWarning["severity"],
): string {
  return severity === "recommendation" ? "Recommendation" : "Warning";
}

/**
 * Advisory compatibility banners — never block simulation or cover controls.
 * Placed directly under the sticky Projected Outcome summary.
 */
export function CompatibilityWarnings({
  warnings,
}: CompatibilityWarningsProps) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <s-stack direction="block" gap="small-200">
      {warnings.map((warning) => (
        <s-banner
          key={warning.id}
          tone={bannerTone(warning.severity)}
          heading={`${severityLabel(warning.severity)} · ${warning.heading}`}
        >
          <s-stack direction="block" gap="small-200">
            <s-text type="strong">Currently active</s-text>
            <s-unordered-list>
              {warning.strategyLabels.map((label) => (
                <s-list-item key={label}>{label}</s-list-item>
              ))}
            </s-unordered-list>
            <s-text>{warning.rationale}</s-text>
            <s-text>{warning.calculatedNote}</s-text>
            <s-text>{warning.recommendation}</s-text>
          </s-stack>
        </s-banner>
      ))}
    </s-stack>
  );
}
