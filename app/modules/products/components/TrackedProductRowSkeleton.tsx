/**
 * Skeleton placeholder matching TrackedProductRow layout to avoid layout shift.
 */
export function TrackedProductRowSkeleton() {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <s-stack
        direction="inline"
        gap="base"
        alignItems="center"
        justifyContent="space-between"
      >
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-thumbnail alt="" size="small" />
          <s-stack direction="block" gap="small-100">
            <s-skeleton-paragraph content="Product title placeholder" />
            <s-skeleton-paragraph content="Status" />
          </s-stack>
        </s-stack>
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-skeleton-paragraph content="Tracked Jan 1, 2026" />
          <s-skeleton-paragraph content="Open" />
        </s-stack>
      </s-stack>
    </s-box>
  );
}
