import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher, useRevalidator } from "react-router";

import { useIsNavigatingTo } from "~/hooks";

import {
  compareSavedComparisonHref,
  DELETE_SAVED_COMPARISON_INTENT,
  DELETE_SAVED_COMPARISON_MODAL_ID,
  formatSavedComparisonProductCount,
  parseSavedComparisonName,
  RENAME_SAVED_COMPARISON_INTENT,
  RENAME_SAVED_COMPARISON_MODAL_ID,
  SAVED_COMPARISON_NAME_MAX_LENGTH,
  type SavedComparisonActionData,
  type SavedComparisonSummary,
} from "../lib/savedComparisons";

type SavedComparisonsListProps = {
  comparisons: SavedComparisonSummary[];
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
 * Compact discovery list for reusable comparison groups.
 * Open uses the existing Compare pricing scenarios page.
 */
export function SavedComparisonsList({
  comparisons,
}: SavedComparisonsListProps) {
  const renameFetcher = useFetcher<SavedComparisonActionData>();
  const deleteFetcher = useFetcher<SavedComparisonActionData>();
  const revalidator = useRevalidator();
  const renameModalRef = useRef<ModalElement | null>(null);
  const deleteModalRef = useRef<ModalElement | null>(null);
  const handledRename = useRef(false);
  const handledDelete = useRef(false);

  const [pending, setPending] = useState<SavedComparisonSummary | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameFieldError, setRenameFieldError] = useState<string | null>(null);

  const isRenaming = renameFetcher.state !== "idle";
  const isDeleting = deleteFetcher.state !== "idle";

  useEffect(() => {
    if (renameFetcher.state === "submitting") {
      handledRename.current = false;
      return;
    }

    if (
      renameFetcher.state === "idle" &&
      renameFetcher.data != null &&
      !handledRename.current
    ) {
      handledRename.current = true;

      if (renameFetcher.data.ok) {
        renameModalRef.current?.hideOverlay();
        setPending(null);
        setRenameValue("");
        setRenameFieldError(null);
        shopify.toast.show("Comparison renamed");
        revalidator.revalidate();
      }
    }
  }, [renameFetcher.state, renameFetcher.data, revalidator]);

  useEffect(() => {
    if (deleteFetcher.state === "submitting") {
      handledDelete.current = false;
      return;
    }

    if (
      deleteFetcher.state === "idle" &&
      deleteFetcher.data != null &&
      !handledDelete.current
    ) {
      handledDelete.current = true;

      if (deleteFetcher.data.ok) {
        deleteModalRef.current?.hideOverlay();
        setPending(null);
        shopify.toast.show("Saved comparison deleted");
        revalidator.revalidate();
      }
    }
  }, [deleteFetcher.state, deleteFetcher.data, revalidator]);

  const handleRenameRequest = useCallback((comparison: SavedComparisonSummary) => {
    setPending(comparison);
    setRenameValue(comparison.name);
    setRenameFieldError(null);
    requestAnimationFrame(() => {
      renameModalRef.current?.showOverlay();
    });
  }, []);

  const handleDeleteRequest = useCallback((comparison: SavedComparisonSummary) => {
    setPending(comparison);
    requestAnimationFrame(() => {
      deleteModalRef.current?.showOverlay();
    });
  }, []);

  const handleRenameCancel = useCallback(() => {
    if (isRenaming) {
      return;
    }
    renameModalRef.current?.hideOverlay();
    setPending(null);
    setRenameFieldError(null);
  }, [isRenaming]);

  const handleDeleteCancel = useCallback(() => {
    if (isDeleting) {
      return;
    }
    deleteModalRef.current?.hideOverlay();
    setPending(null);
  }, [isDeleting]);

  const handleRenameConfirm = useCallback(() => {
    if (!pending || isRenaming) {
      return;
    }

    const parsed = parseSavedComparisonName(renameValue);
    if (!parsed.ok) {
      setRenameFieldError(parsed.error);
      return;
    }

    setRenameFieldError(null);
    handledRename.current = false;
    renameFetcher.submit(
      {
        intent: RENAME_SAVED_COMPARISON_INTENT,
        savedComparisonId: pending.id,
        name: parsed.name,
      },
      { method: "post" },
    );
  }, [isRenaming, pending, renameFetcher, renameValue]);

  const handleDeleteConfirm = useCallback(() => {
    if (!pending || isDeleting) {
      return;
    }

    handledDelete.current = false;
    deleteFetcher.submit(
      {
        intent: DELETE_SAVED_COMPARISON_INTENT,
        savedComparisonId: pending.id,
      },
      { method: "post" },
    );
  }, [deleteFetcher, isDeleting, pending]);

  if (comparisons.length === 0) {
    return null;
  }

  const renameError =
    renameFetcher.data != null && !renameFetcher.data.ok
      ? renameFetcher.data.error
      : null;
  const deleteError =
    deleteFetcher.data != null && !deleteFetcher.data.ok
      ? deleteFetcher.data.error
      : null;

  return (
    <>
      <s-section heading="Saved comparisons" accessibilityLabel="Saved comparisons">
        <s-table>
          <s-table-header-row>
            <s-table-header listSlot="primary">Name</s-table-header>
            <s-table-header listSlot="labeled">Products</s-table-header>
            <s-table-header listSlot="labeled">Actions</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {comparisons.map((comparison) => (
              <SavedComparisonRow
                key={comparison.id}
                comparison={comparison}
                busy={isRenaming || isDeleting}
                onRename={handleRenameRequest}
                onDelete={handleDeleteRequest}
              />
            ))}
          </s-table-body>
        </s-table>
      </s-section>

      <s-modal
        id={RENAME_SAVED_COMPARISON_MODAL_ID}
        heading="Rename comparison"
        ref={renameModalRef as never}
      >
        <s-stack direction="block" gap="base">
          <s-text-field
            label="Name"
            name="savedComparisonName"
            value={renameValue}
            maxLength={SAVED_COMPARISON_NAME_MAX_LENGTH}
            error={renameFieldError ?? undefined}
            autocomplete="off"
            onInput={(event: Event) => {
              setRenameValue(readEventValue(event));
              if (renameFieldError) {
                setRenameFieldError(null);
              }
            }}
            onChange={(event: Event) => {
              setRenameValue(readEventValue(event));
            }}
          />
          {renameError ? (
            <s-banner tone="critical" heading="Couldn't rename comparison">
              <s-text>{renameError}</s-text>
            </s-banner>
          ) : null}
        </s-stack>
        <s-button
          slot="primary-action"
          variant="primary"
          disabled={isRenaming || pending == null}
          loading={isRenaming}
          onClick={handleRenameConfirm}
        >
          Save
        </s-button>
        <s-button
          slot="secondary-actions"
          variant="secondary"
          disabled={isRenaming}
          onClick={handleRenameCancel}
        >
          Cancel
        </s-button>
      </s-modal>

      <s-modal
        id={DELETE_SAVED_COMPARISON_MODAL_ID}
        heading="Delete saved comparison?"
        ref={deleteModalRef as never}
      >
        <s-stack direction="block" gap="small-100">
          <s-paragraph>
            This removes the saved group only. Tracked products, costs, and
            Shopify prices are not changed.
          </s-paragraph>
          {pending ? (
            <s-text type="strong">{pending.name}</s-text>
          ) : null}
          {deleteError ? (
            <s-banner tone="critical" heading="Couldn't delete comparison">
              <s-text>{deleteError}</s-text>
            </s-banner>
          ) : null}
        </s-stack>
        <s-button
          slot="primary-action"
          variant="primary"
          tone="critical"
          disabled={isDeleting || pending == null}
          loading={isDeleting}
          onClick={handleDeleteConfirm}
        >
          Delete
        </s-button>
        <s-button
          slot="secondary-actions"
          variant="secondary"
          disabled={isDeleting}
          onClick={handleDeleteCancel}
        >
          Cancel
        </s-button>
      </s-modal>
    </>
  );
}

function SavedComparisonRow({
  comparison,
  busy,
  onRename,
  onDelete,
}: {
  comparison: SavedComparisonSummary;
  busy: boolean;
  onRename: (comparison: SavedComparisonSummary) => void;
  onDelete: (comparison: SavedComparisonSummary) => void;
}) {
  const openHref = compareSavedComparisonHref(comparison.id);
  const isOpening = useIsNavigatingTo(openHref);

  return (
    <s-table-row>
      <s-table-cell>
        <s-text type="strong">{comparison.name}</s-text>
      </s-table-cell>
      <s-table-cell>
        {formatSavedComparisonProductCount(comparison.productCount)}
      </s-table-cell>
      <s-table-cell>
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-button href={openHref} variant="secondary" loading={isOpening}>
            Open
          </s-button>
          <s-button
            variant="tertiary"
            disabled={busy || isOpening}
            onClick={() => onRename(comparison)}
          >
            Rename
          </s-button>
          <s-button
            variant="tertiary"
            tone="critical"
            disabled={busy || isOpening}
            onClick={() => onDelete(comparison)}
          >
            Delete
          </s-button>
        </s-stack>
      </s-table-cell>
    </s-table-row>
  );
}
