import { useIsNavigatingTo } from "~/hooks";

import type { ProductsPageInfo } from "../types";

type ProductsPaginationProps = {
  pageInfo: ProductsPageInfo;
};

function buildPageHref(
  cursor: string | null,
  direction: "after" | "before",
): string | undefined {
  if (!cursor) {
    return undefined;
  }

  const params = new URLSearchParams();
  params.set(direction, cursor);
  return `/app/products?${params.toString()}`;
}

export function ProductsPagination({ pageInfo }: ProductsPaginationProps) {
  if (!pageInfo.hasNextPage && !pageInfo.hasPreviousPage) {
    return null;
  }

  const previousHref = pageInfo.hasPreviousPage
    ? buildPageHref(pageInfo.startCursor, "before")
    : undefined;
  const nextHref = pageInfo.hasNextPage
    ? buildPageHref(pageInfo.endCursor, "after")
    : undefined;

  return (
    <PaginationButtons previousHref={previousHref} nextHref={nextHref} />
  );
}

function PaginationButtons({
  previousHref,
  nextHref,
}: {
  previousHref: string | undefined;
  nextHref: string | undefined;
}) {
  const isLoadingPrevious = useIsNavigatingTo(previousHref);
  const isLoadingNext = useIsNavigatingTo(nextHref);

  return (
    <s-stack direction="inline" gap="base" justifyContent="center">
      <s-button
        href={previousHref}
        disabled={!previousHref || isLoadingNext}
        loading={isLoadingPrevious}
        variant="secondary"
      >
        Previous
      </s-button>
      <s-button
        href={nextHref}
        disabled={!nextHref || isLoadingPrevious}
        loading={isLoadingNext}
        variant="secondary"
      >
        Next
      </s-button>
    </s-stack>
  );
}
