import type { CSSProperties, ReactNode } from "react";

import type {
  OutcomeStatus,
  ProjectedOutcome,
} from "../lib/simulateProjectedOutcome";
import {
  formatMarginPercent,
  formatProfitLoss,
} from "../lib/simulateProjectedOutcome";

type ProjectedOutcomeBarProps = {
  outcome: ProjectedOutcome;
  currency: string;
  /**
   * Optional content rendered directly under the summary (e.g. compatibility
   * warnings). Stays sticky with the outcome so advice remains visible while
   * editing strategies.
   */
  belowSummary?: ReactNode;
};

const stickyStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 20,
};

function statusTone(
  status: OutcomeStatus | null,
): "success" | "critical" | "neutral" {
  if (status === "Profit") {
    return "success";
  }
  if (status === "Loss") {
    return "critical";
  }
  return "neutral";
}

/**
 * Compact sticky projected outcome — stays visible while editing strategies.
 */
export function ProjectedOutcomeBar({
  outcome,
  currency,
  belowSummary,
}: ProjectedOutcomeBarProps) {
  const statusLabel = outcome.status ?? "—";

  return (
    <div style={stickyStyle}>
      <s-stack direction="block" gap="small-200">
        <s-box
          padding="base"
          borderWidth="base"
          borderRadius="base"
          background="subdued"
        >
          <s-stack direction="inline" gap="large-200" alignItems="center">
            <s-stack direction="block" gap="small-100">
              <s-text color="subdued">Profit / Loss</s-text>
              <s-text type="strong">
                {formatProfitLoss(outcome.profitLoss, currency)}
              </s-text>
            </s-stack>
            <s-stack direction="block" gap="small-100">
              <s-text color="subdued">Margin</s-text>
              <s-text type="strong">
                {formatMarginPercent(outcome.marginPercent)}
              </s-text>
            </s-stack>
            <s-stack direction="block" gap="small-100">
              <s-text color="subdued">Status</s-text>
              <s-badge tone={statusTone(outcome.status)}>
                {statusLabel}
              </s-badge>
            </s-stack>
          </s-stack>
        </s-box>
        {belowSummary}
      </s-stack>
    </div>
  );
}
