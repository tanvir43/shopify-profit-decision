import type { CSSProperties } from "react";

import type {
  OutcomeStatus,
  ProjectedOutcome,
} from "../lib/simulateProjectedOutcome";
import {
  formatMarginPercent,
  formatProfitLoss,
} from "../lib/simulateProjectedOutcome";

type StickyWorkspaceHeaderProps = {
  productTitle: string;
  costDisplay: string;
  sellingPriceDisplay: string;
  outcome: ProjectedOutcome;
  currency: string;
};

/**
 * Sticky workspace header — compact essentials while editing strategies.
 * Must be a direct child of the page-level stack (not a short wrapper),
 * otherwise sticky is clipped to that wrapper and scrolls away.
 * Opaque backdrop keeps scrolling strategy content from showing through.
 */
const stickyStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 20,
  background: "var(--p-color-bg-surface, var(--p-color-bg, #ffffff))",
  paddingBlockEnd: "var(--p-space-200, 8px)",
};

const rowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "var(--p-space-400, 16px) var(--p-space-600, 24px)",
};

const metricStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--p-space-100, 4px)",
  minWidth: 0,
};

const productNameStyle: CSSProperties = {
  ...metricStyle,
  flex: "1 1 10rem",
  maxWidth: "100%",
};

const productNameTextStyle: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  maxWidth: "100%",
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
 * Compact sticky header: product + cost + price + live projected outcome.
 */
export function StickyWorkspaceHeader({
  productTitle,
  costDisplay,
  sellingPriceDisplay,
  outcome,
  currency,
}: StickyWorkspaceHeaderProps) {
  const statusLabel = outcome.status ?? "—";

  return (
    <div style={stickyStyle}>
      <s-box
        padding="base"
        borderWidth="base"
        borderRadius="base"
        background="subdued"
      >
        <div style={rowStyle}>
          <div style={productNameStyle}>
            <s-text color="subdued">Product Name</s-text>
            <div style={productNameTextStyle}>
              <s-text type="strong">{productTitle}</s-text>
            </div>
          </div>
          <div style={metricStyle}>
            <s-text color="subdued">Product Cost</s-text>
            <s-text type="strong">{costDisplay}</s-text>
          </div>
          <div style={metricStyle}>
            <s-text color="subdued">Selling Price</s-text>
            <s-text type="strong">{sellingPriceDisplay}</s-text>
          </div>
          <div style={metricStyle}>
            <s-text color="subdued">Profit / Loss</s-text>
            <s-text type="strong">
              {formatProfitLoss(outcome.profitLoss, currency)}
            </s-text>
          </div>
          <div style={metricStyle}>
            <s-text color="subdued">Margin</s-text>
            <s-text type="strong">
              {formatMarginPercent(outcome.marginPercent)}
            </s-text>
          </div>
          <div style={metricStyle}>
            <s-text color="subdued">Status</s-text>
            <s-badge tone={statusTone(outcome.status)}>{statusLabel}</s-badge>
          </div>
        </div>
      </s-box>
    </div>
  );
}
