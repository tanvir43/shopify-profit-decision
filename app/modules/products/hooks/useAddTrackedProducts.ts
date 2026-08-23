import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher, useRevalidator } from "react-router";

export type TrackProductsActionData =
  | { ok: true; newlyTracked: number }
  | { ok: false; error: string };

/** Shown when the merchant tries to add a product that is already tracked. */
export const ALREADY_TRACKED_MESSAGE =
  "This Product already been added in your tracked product list";

type UseAddTrackedProductsOptions = {
  /** Shopify product GIDs currently on the tracked list. */
  trackedShopifyProductIds: string[];
};

/**
 * Opens Shopify Resource Picker and tracks selected product references.
 * Already-tracked products are preselected so they appear marked in the modal.
 * Business rules live in TrackedProductService — this hook only handles UI flow.
 */
export function useAddTrackedProducts({
  trackedShopifyProductIds,
}: UseAddTrackedProductsOptions) {
  const fetcher = useFetcher<TrackProductsActionData>();
  const revalidator = useRevalidator();
  const [trackError, setTrackError] = useState<string | null>(null);
  const handledSubmission = useRef(false);
  const trackedIdsRef = useRef(trackedShopifyProductIds);

  trackedIdsRef.current = trackedShopifyProductIds;

  const isTracking = fetcher.state !== "idle";

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
        revalidator.revalidate();
      } else {
        setTrackError(fetcher.data.error);
      }
    }
  }, [fetcher.state, fetcher.data, revalidator]);

  const addProducts = useCallback(async () => {
    setTrackError(null);

    const alreadyTrackedIds = new Set(trackedIdsRef.current);

    const selection = await shopify.resourcePicker({
      type: "product",
      multiple: true,
      action: "add",
      filter: {
        variants: false,
      },
      // Preselect tracked products so they appear marked as already chosen.
      selectionIds: trackedIdsRef.current.map((id) => ({ id })),
    });

    if (!selection || selection.length === 0) {
      return;
    }

    const selectedIds = selection.map((product) => product.id);
    const newProductIds = selectedIds.filter((id) => !alreadyTrackedIds.has(id));

    if (newProductIds.length === 0) {
      setTrackError(ALREADY_TRACKED_MESSAGE);
      return;
    }

    fetcher.submit(
      { productIds: JSON.stringify(newProductIds) },
      { method: "post" },
    );
  }, [fetcher]);

  const clearTrackError = useCallback(() => {
    setTrackError(null);
  }, []);

  return {
    addProducts,
    isTracking,
    trackError,
    clearTrackError,
  };
}
