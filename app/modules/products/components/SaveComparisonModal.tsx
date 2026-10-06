import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

import {
  buildSaveComparisonFormPayload,
  parseSavedComparisonName,
  SAVE_COMPARISON_MODAL_ID,
  SAVED_COMPARISON_NAME_MAX_LENGTH,
  type SavedComparisonActionData,
  type SavedComparisonItemInput,
} from "../lib/savedComparisons";

type SaveComparisonModalProps = {
  items: SavedComparisonItemInput[];
};

type ModalElement = HTMLElement & {
  showOverlay: () => void;
  hideOverlay: () => void;
};

function readEventValue(event: Event): string {
  const currentTarget = event.currentTarget as { value?: string } | null;
  if (currentTarget && typeof currentTarget.value === "string") {
    return currentTarget.value;
  }

  const target = event.target as { value?: string } | null;
  return typeof target?.value === "string" ? target.value : "";
}

/**
 * Lightweight Save comparison dialog — persists product/variant membership only.
 */
export function SaveComparisonModal({ items }: SaveComparisonModalProps) {
  const fetcher = useFetcher<SavedComparisonActionData>();
  const modalRef = useRef<ModalElement | null>(null);
  const handledSubmission = useRef(false);
  const [name, setName] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const isSaving = fetcher.state !== "idle";
  const canSave = items.length > 0 && !isSaving;

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
        setName("");
        setFieldError(null);
        shopify.toast.show("Comparison saved");
      }
    }
  }, [fetcher.state, fetcher.data]);

  const handleCancel = useCallback(() => {
    if (isSaving) {
      return;
    }

    modalRef.current?.hideOverlay();
  }, [isSaving]);

  const handleSave = useCallback(() => {
    if (!canSave) {
      return;
    }

    const parsed = parseSavedComparisonName(name);
    if (!parsed.ok) {
      setFieldError(parsed.error);
      return;
    }

    setFieldError(null);
    handledSubmission.current = false;
    fetcher.submit(buildSaveComparisonFormPayload(parsed.name, items), {
      method: "post",
      action: "/app/products/compare",
    });
  }, [canSave, fetcher, items, name]);

  const submitError =
    fetcher.data != null && !fetcher.data.ok ? fetcher.data.error : null;

  return (
    <s-modal
      id={SAVE_COMPARISON_MODAL_ID}
      heading="Save comparison"
      ref={modalRef as never}
    >
      <s-stack direction="block" gap="base">
        <s-text-field
          label="Name"
          name="savedComparisonName"
          value={name}
          maxLength={SAVED_COMPARISON_NAME_MAX_LENGTH}
          error={fieldError ?? undefined}
          autocomplete="off"
          onInput={(event: Event) => {
            setName(readEventValue(event));
            if (fieldError) {
              setFieldError(null);
            }
          }}
          onChange={(event: Event) => {
            setName(readEventValue(event));
          }}
        />
        {submitError ? (
          <s-banner tone="critical" heading="Couldn't save comparison">
            <s-text>{submitError}</s-text>
          </s-banner>
        ) : null}
      </s-stack>

      <s-button
        slot="primary-action"
        variant="primary"
        disabled={!canSave}
        loading={isSaving}
        onClick={handleSave}
      >
        Save
      </s-button>
      <s-button
        slot="secondary-actions"
        variant="secondary"
        disabled={isSaving}
        onClick={handleCancel}
      >
        Cancel
      </s-button>
    </s-modal>
  );
}
