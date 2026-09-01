import type { TrackedProductWorkspaceItem } from "../types/TrackedProductWorkspaceItem";

function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

function matchesSearchText(value: string, normalizedQuery: string): boolean {
  return value.toLowerCase().includes(normalizedQuery);
}

/**
 * Filters tracked workspace rows by product title or any variant title.
 */
export function filterTrackedProductsBySearch(
  products: TrackedProductWorkspaceItem[],
  query: string,
): TrackedProductWorkspaceItem[] {
  const normalizedQuery = normalizeSearchQuery(query);

  if (!normalizedQuery) {
    return products;
  }

  return products.filter((product) => {
    if (matchesSearchText(product.title, normalizedQuery)) {
      return true;
    }

    return product.variants.some((variant) =>
      matchesSearchText(variant.title, normalizedQuery),
    );
  });
}
