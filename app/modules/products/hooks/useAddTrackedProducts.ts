import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher, useRevalidator } from "react-router";

export type TrackProductsActionData =
  | { ok: true; newlyTracked: number }
  | { ok: false; error: string };

/**
 * Opens Shopify Resource Picker and tracks selected product references.
 * Business rules live in TrackedProductService — this hook only handles UI flow.
 */
export function useAddTrackedProducts() {
  const fetcher = useFetcher<TrackProductsActionData>();
  const revalidator = useRevalidator();
  const [trackError, setTrackError] = useState<string | null>(null);
  const handledSubmission = useRef(false);

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

    const selection = await shopify.resourcePicker({
      type: "product",
      multiple: true,
      action: "add",
      filter: {
        variants: false,
      },
    });

    if (!selection || selection.length === 0) {
      return;
    }

    const productIds = selection.map((product) => product.id);

    fetcher.submit(
      { productIds: JSON.stringify(productIds) },
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
