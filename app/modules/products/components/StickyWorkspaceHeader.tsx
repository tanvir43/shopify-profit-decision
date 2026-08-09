import { useEffect, useRef, useState, type CSSProperties } from "react";

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

/** Groups Profit/Loss, Status, and Margin as one calculated-result focus. */
const resultGroupStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-end",
  gap: "var(--p-space-300, 12px) var(--p-space-400, 16px)",
  minWidth: 0,
  transition: "opacity 250ms ease",
};

const profitRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "var(--p-space-200, 8px)",
  minWidth: 0,
};

const profitValueBaseStyle: CSSProperties = {
  fontSize: "1.25rem",
  fontWeight: 700,
  lineHeight: 1.2,
};

const marginValueStyle: CSSProperties = {
  fontSize: "1.05rem",
  fontWeight: 600,
  lineHeight: 1.2,
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

/** Existing Polaris success / critical text tokens — no new colors. */
function profitValueStyle(status: OutcomeStatus | null): CSSProperties {
  if (status === "Profit") {
    return {
      ...profitValueBaseStyle,
      color: "var(--p-color-text-success, #014b40)",
    };
  }
  if (status === "Loss") {
    return {
      ...profitValueBaseStyle,
      color: "var(--p-color-text-critical, #8e0b21)",
    };
  }
  return profitValueBaseStyle;
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
  const [resultOpacity, setResultOpacity] = useState(1);
  const prevProfitLossRef = useRef(outcome.profitLoss);
  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      prevProfitLossRef.current = outcome.profitLoss;
      return;
    }

    if (prevProfitLossRef.current === outcome.profitLoss) {
      return;
    }

    prevProfitLossRef.current = outcome.profitLoss;
    setResultOpacity(0.45);
    const restoreId = window.setTimeout(() => {
      setResultOpacity(1);
    }, 40);

    return () => {
      window.clearTimeout(restoreId);
    };
  }, [outcome.profitLoss]);

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
          <div style={{ ...resultGroupStyle, opacity: resultOpacity }}>
            <div style={metricStyle}>
              <s-text color="subdued">Profit / Loss</s-text>
              <div style={profitRowStyle}>
                <span style={profitValueStyle(outcome.status)}>
                  {formatProfitLoss(outcome.profitLoss, currency)}
                </span>
                <s-badge tone={statusTone(outcome.status)}>
                  {statusLabel}
                </s-badge>
              </div>
            </div>
            <div style={metricStyle}>
              <s-text color="subdued">Margin</s-text>
              <span style={marginValueStyle}>
                {formatMarginPercent(outcome.marginPercent)}
              </span>
            </div>
          </div>
        </div>
      </s-box>
    </div>
  );
}
