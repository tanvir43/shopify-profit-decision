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
};

export function TrackedProductRow({
  trackedProductId,
  shopifyProductId,
  title,
  status,
  imageUrl,
  imageAlt,
  trackedAt,
  onStopTracking,
  stopTrackingDisabled = false,
}: TrackedProductRowProps) {
  const { label, tone } = formatProductStatus(status);
  const unavailable = isTrackedProductUnavailable(status);
  const thumbnailAlt =
    imageUrl && imageAlt
      ? imageAlt
      : imageUrl
        ? `Photo of ${title}`
        : "";

  return (
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
            <s-badge tone={tone}>{label}</s-badge>
          </s-stack>
        </s-stack>
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-text color="subdued">Tracked {trackedAt}</s-text>
          {onStopTracking ? (
            <s-button
              variant="tertiary"
              tone="critical"
              disabled={stopTrackingDisabled}
              onClick={() =>
                onStopTracking({
                  trackedProductId,
                  shopifyProductId,
                  title,
                  status,
                  imageUrl,
                  imageAlt,
                  trackedAt,
                })
              }
            >
              Stop Tracking
            </s-button>
          ) : null}
          <s-button
            href={unavailable ? undefined : trackedProductHref(trackedProductId)}
            variant="secondary"
            disabled={unavailable}
          >
            Open
          </s-button>
        </s-stack>
      </s-stack>
    </s-box>
  );
}
