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
 * Rendered under the Sticky Workspace Header; not sticky themselves so they
 * do not dominate the viewport while scrolling.
 */
export function CompatibilityWarnings({
  warnings,
}: CompatibilityWarningsProps) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <s-stack direction="block" gap="small-100">
      {warnings.map((warning) => (
        <s-banner
          key={warning.id}
          tone={bannerTone(warning.severity)}
          heading={severityLabel(warning.severity)}
        >
          <s-stack direction="block" gap="small-100">
            <s-text type="strong">{warning.heading}</s-text>
            <s-text color="subdued">Currently active</s-text>
            <s-unordered-list>
              {warning.strategyLabels.map((label) => (
                <s-list-item key={label}>{label}</s-list-item>
              ))}
            </s-unordered-list>
            <s-text>{warning.rationale}</s-text>
            <s-text color="subdued">{warning.calculatedNote}</s-text>
            <s-text>{warning.recommendation}</s-text>
          </s-stack>
        </s-banner>
      ))}
    </s-stack>
  );
}
