import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFetcher, useRevalidator, useSearchParams } from "react-router";

import { filterTrackedProductsBySearch } from "../lib/filterTrackedProductsBySearch";
import { TrackedProductRow } from "./TrackedProductRow";
import { TrackedProductRowSkeleton } from "./TrackedProductRowSkeleton";
import { TrackedProductsEmptyState } from "./TrackedProductsEmptyState";
import type { TrackedProductWorkspaceItem } from "../types/TrackedProductWorkspaceItem";

/** TEMP-001 — remove before App Store submission. */
export const STOP_TRACKING_MODAL_ID = "temp-stop-tracking-modal";

/** How long the back-navigation highlight stays visible. */
const HIGHLIGHT_DURATION_MS = 10000;

export type StopTrackingActionData =
  | { ok: true }
  | { ok: false; error: string };

type ModalElement = HTMLElement & {
  showOverlay: () => void;
  hideOverlay: () => void;
};

type TrackedProductListProps = {
  products: TrackedProductWorkspaceItem[];
  onAddProducts: () => void;
  addProductsDisabled?: boolean;
};

function readEventValue(event: Event): string {
  const currentTarget = event.currentTarget as { value?: string } | null;
  if (currentTarget && typeof currentTarget.value === "string") {
    return currentTarget.value;
  }

  const target = event.target as { value?: string } | null;
  return typeof target?.value === "string" ? target.value : "";
}

/** Matches compact form fields elsewhere in the workspace (e.g. strategy inputs). */
const PRODUCT_SEARCH_FIELD_MAX_WIDTH = "320px";

export function TrackedProductList({
  products,
  onAddProducts,
  addProductsDisabled = false,
}: TrackedProductListProps) {
  const fetcher = useFetcher<StopTrackingActionData>();
  const revalidator = useRevalidator();
  const [searchParams, setSearchParams] = useSearchParams();
  const modalRef = useRef<ModalElement | null>(null);
  const handledSubmission = useRef(false);
  const [pendingProduct, setPendingProduct] =
    useState<TrackedProductWorkspaceItem | null>(null);
  const [highlightedProductId, setHighlightedProductId] = useState<
    string | null
  >(null);
  const [searchQuery, setSearchQuery] = useState("");

  const isStopping = fetcher.state !== "idle";
  const highlightFromUrl = searchParams.get("highlight")?.trim() || null;
  const filteredProducts = useMemo(
    () => filterTrackedProductsBySearch(products, searchQuery),
    [products, searchQuery],
  );
  const hasActiveSearch = searchQuery.trim().length > 0;

  const handleSearchInput = useCallback((event: Event) => {
    setSearchQuery(readEventValue(event));
  }, []);

  useEffect(() => {
    if (!highlightFromUrl) {
      return;
    }

    setHighlightedProductId(highlightFromUrl);

    const clearTimer = window.setTimeout(() => {
      setHighlightedProductId(null);
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete("highlight");
          return next;
        },
        { replace: true },
      );
    }, HIGHLIGHT_DURATION_MS);

    return () => {
      window.clearTimeout(clearTimer);
    };
  }, [highlightFromUrl, setSearchParams]);

  useEffect(() => {
    if (fetcher.state === "submitting") {
      handledSubmission.current = false;
      return;
    }

    if (
      fetcher.state === "idle" &&
      fetcher.data != null &&
      !handledSubmission.current
    ) {
      handledSubmission.current = true;

      if (fetcher.data.ok) {
        modalRef.current?.hideOverlay();
        setPendingProduct(null);
        shopify.toast.show(
          "Product removed from ProfitPilot. Your Shopify product was not changed.",
        );
        revalidator.revalidate();
      }
    }
  }, [fetcher.state, fetcher.data, revalidator]);

  const handleStopTrackingRequest = useCallback(
    (product: TrackedProductWorkspaceItem) => {
      if (isStopping) {
        return;
      }

      setPendingProduct(product);
      requestAnimationFrame(() => {
        modalRef.current?.showOverlay();
      });
    },
    [isStopping],
  );

  const handleConfirmStopTracking = useCallback(() => {
    if (!pendingProduct || isStopping) {
      return;
    }

    fetcher.submit(
      {
        intent: "stop-tracking",
        shopifyProductId: pendingProduct.shopifyProductId,
      },
      { method: "post" },
    );
  }, [fetcher, isStopping, pendingProduct]);

  const handleCancelStopTracking = useCallback(() => {
    if (isStopping) {
      return;
    }

    modalRef.current?.hideOverlay();
    setPendingProduct(null);
  }, [isStopping]);

  if (products.length === 0) {
    return (
      <TrackedProductsEmptyState
        onAddProducts={onAddProducts}
        addProductsDisabled={addProductsDisabled}
      />
    );
  }

  return (
    <>
      <s-stack direction="block" gap="base">
        <s-box
          maxInlineSize={PRODUCT_SEARCH_FIELD_MAX_WIDTH}
          inlineSize="100%"
        >
          <s-text-field
            label="Search products"
            name="productSearch"
            placeholder="Search with product/variant name"
            value={searchQuery}
            onInput={handleSearchInput}
            onChange={handleSearchInput}
          />
        </s-box>

        {hasActiveSearch && filteredProducts.length === 0 ? (
          <s-banner tone="info" heading="No matching products">
            <s-text>
              No tracked products match &quot;{searchQuery.trim()}&quot;. Try
              another product or variant name.
            </s-text>
          </s-banner>
        ) : null}

        <s-stack direction="block" gap="small-100">
          {filteredProducts.map((product) => (
            <TrackedProductRow
              key={product.trackedProductId}
              {...product}
              onStopTracking={handleStopTrackingRequest}
              stopTrackingDisabled={isStopping}
              highlighted={product.trackedProductId === highlightedProductId}
            />
          ))}
        </s-stack>
      </s-stack>

      {/* TEMP-001 — temporary Launch Sprint testing helper; remove before App Store submission. */}
      <s-modal
        id={STOP_TRACKING_MODAL_ID}
        heading="Stop Tracking Product?"
        size="base"
        ref={modalRef as never}
      >
        <s-stack direction="block" gap="small-100">
          <s-paragraph>
            This will remove the product from ProfitPilot only.
          </s-paragraph>
          <s-paragraph>
            Your Shopify product will NOT be deleted or modified.
          </s-paragraph>
          <s-paragraph color="subdued">
            You can track this product again at any time.
          </s-paragraph>
          {fetcher.data != null && !fetcher.data.ok ? (
            <s-banner tone="critical" heading="Couldn't stop tracking">
              <s-text>{fetcher.data.error}</s-text>
            </s-banner>
          ) : null}
        </s-stack>

        <s-button
          slot="primary-action"
          variant="primary"
          tone="critical"
          disabled={isStopping || pendingProduct == null}
          loading={isStopping}
          onClick={handleConfirmStopTracking}
        >
          Stop Tracking
        </s-button>
        <s-button
          slot="secondary-actions"
          variant="secondary"
          disabled={isStopping}
          onClick={handleCancelStopTracking}
        >
          Cancel
        </s-button>
      </s-modal>
    </>
  );
}

type TrackedProductListSkeletonProps = {
  count: number;
};

export function TrackedProductListSkeleton({
  count,
}: TrackedProductListSkeletonProps) {
  return (
    <s-stack direction="block" gap="small-100">
      {Array.from({ length: count }, (_, index) => (
        <TrackedProductRowSkeleton key={index} />
      ))}
    </s-stack>
  );
}
