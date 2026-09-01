import { useEffect, useRef, type CSSProperties } from "react";

import { useIsNavigatingTo } from "~/hooks";

import {
  formatProductStatus,
  isTrackedProductUnavailable,
  trackedProductHref,
} from "../lib/productStatus";
import type { TrackedProductWorkspaceItem } from "../types/TrackedProductWorkspaceItem";

type TrackedProductRowProps = TrackedProductWorkspaceItem & {
  /** TEMP-001 — temporary Launch Sprint testing helper; remove before App Store submission. */
  onStopTracking?: (product: TrackedProductWorkspaceItem) => void;
  stopTrackingDisabled?: boolean;
  /** Briefly emphasize the row after returning from the product detail page. */
  highlighted?: boolean;
};

/** Focus treatment for the product the merchant just navigated back from. */
const highlightedRowStyle: CSSProperties = {
  borderRadius: "var(--p-border-radius-200, 8px)",
  background: "var(--p-color-bg-surface-info, #eaf4ff)",
  boxShadow: "0 0 0 2px var(--p-color-border-info, #005bd3)",
  transition: "background 0.35s ease, box-shadow 0.35s ease",
};

export function TrackedProductRow({
  trackedProductId,
  shopifyProductId,
  title,
  status,
  imageUrl,
  imageAlt,
  trackedAt,
  hasProductCost,
  variants,
  selectedShopifyVariantId,
  onStopTracking,
  stopTrackingDisabled = false,
  highlighted = false,
}: TrackedProductRowProps) {
  const { label, tone } = formatProductStatus(status);
  const unavailable = isTrackedProductUnavailable(status);
  const actionHref = unavailable
    ? undefined
    : trackedProductHref(trackedProductId);
  const isOpening = useIsNavigatingTo(actionHref);
  const actionLabel = hasProductCost
    ? "Start Simulation"
    : "Add Product Cost First";
  const rowRef = useRef<HTMLDivElement | null>(null);
  const thumbnailAlt =
    imageUrl && imageAlt
      ? imageAlt
      : imageUrl
        ? `Photo of ${title}`
        : "";
  const selectedVariant =
    variants.length > 1 && selectedShopifyVariantId
      ? variants.find((variant) => variant.id === selectedShopifyVariantId)
      : undefined;

  useEffect(() => {
    if (!highlighted || !rowRef.current) {
      return;
    }

    rowRef.current.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [highlighted]);

  return (
    <div ref={rowRef} style={highlighted ? highlightedRowStyle : undefined}>
      <s-box padding="base" borderWidth="base" borderRadius="base">
        <s-stack
          direction="inline"
          gap="base"
          alignItems="center"
          justifyContent="space-between"
        >
          <s-stack direction="inline" gap="base" alignItems="center">
            {imageUrl ? (
              <s-thumbnail src={imageUrl} alt={thumbnailAlt} size="small" />
            ) : (
              <s-thumbnail alt="" size="small" />
            )}
            <s-stack direction="block" gap="small-100">
              <s-text type="strong">{title}</s-text>
              {selectedVariant ? (
                <s-text color="subdued">
                  Variant: {selectedVariant.title}
                </s-text>
              ) : null}
              <s-badge tone={tone}>{label}</s-badge>
            </s-stack>
          </s-stack>
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-text color="subdued">Tracked {trackedAt}</s-text>
            {onStopTracking ? (
              <s-button
                variant="tertiary"
                tone="critical"
                disabled={stopTrackingDisabled || isOpening}
                onClick={() =>
                  onStopTracking({
                    trackedProductId,
                    shopifyProductId,
                    title,
                    status,
                    imageUrl,
                    imageAlt,
                    trackedAt,
                    hasProductCost,
                    variants,
                    selectedShopifyVariantId,
                  })
                }
              >
                Stop Tracking
              </s-button>
            ) : null}
            <s-button
              href={actionHref}
              variant={hasProductCost ? "primary" : "secondary"}
              disabled={unavailable}
              loading={isOpening}
            >
              {actionLabel}
            </s-button>
          </s-stack>
        </s-stack>
      </s-box>
    </div>
  );
}
