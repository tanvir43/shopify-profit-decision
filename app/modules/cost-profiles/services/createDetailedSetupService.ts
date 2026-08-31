import type { CostProfileRepository } from "../repositories/CostProfileRepository";
import {
  CostProfileValidationError,
} from "../errors";
import { normalizeShopifyVariantId } from "../lib/variantContext";
import { validateDetailedSetupAmount } from "../lib/validateDetailedSetupAmount";
import type { CostItemInput, CostProfile } from "../types";
import {
  COST_ITEM_TYPES,
  COST_ITEM_TYPE_LABELS,
  COST_ITEM_TYPE_SORT_ORDER,
  categoryToCostItemType,
  costItemTypeToCategory,
  type CostItemType,
} from "../types/CostItemType";
import type {
  DetailedSetupService,
  SaveDetailedBreakdownInput,
} from "./DetailedSetupService";

/** ISO 4217 alphabetic code — structural currency identity, not FX logic. */
const ISO_4217_CODE = /^[A-Z]{3}$/;

function assertCurrency(currency: string): void {
  if (!ISO_4217_CODE.test(currency)) {
    throw new CostProfileValidationError(
      `Currency must be a 3-letter ISO 4217 code (received "${currency}").`,
    );
  }
}

function buildItemsFromAmounts(
  amounts: Record<CostItemType, string>,
  existing: CostProfile | null,
): CostItemInput[] {
  const existingByType = new Map<CostItemType, { id: string }>();

  if (existing) {
    for (const item of existing.items) {
      const type = categoryToCostItemType(item.category);
      if (!existingByType.has(type)) {
        existingByType.set(type, { id: item.id });
      }
    }
  }

  const items: CostItemInput[] = [];

  for (const type of COST_ITEM_TYPES) {
    const result = validateDetailedSetupAmount(amounts[type] ?? "");
    if (!result.ok) {
      throw new CostProfileValidationError(
        `${COST_ITEM_TYPE_LABELS[type]}: ${result.message}`,
      );
    }

    if (result.value == null) {
      continue;
    }

    const prior = existingByType.get(type);
    const input: CostItemInput = {
      name: COST_ITEM_TYPE_LABELS[type],
      value: result.value,
      unit: "FIXED",
      category: costItemTypeToCategory(type),
      isActive: true,
      sortOrder: COST_ITEM_TYPE_SORT_ORDER[type],
      isSystem: false,
    };

    if (prior) {
      input.id = prior.id;
    }

    items.push(input);
  }

  return items;
}

/** Sum CostItem values into the profile totalCost used by Decision Workspace. */
function totalCostFromItems(items: CostItemInput[]): string | null {
  if (items.length === 0) {
    return null;
  }

  const total = items.reduce((sum, item) => sum + Number(item.value), 0);
  return total.toFixed(2);
}

/**
 * Application service for the Detailed Cost Builder (PP-0013 / PP-0015.4.5).
 */
export function createDetailedSetupService(
  repository: CostProfileRepository,
): DetailedSetupService {
  return {
    async getDetailedSetupProfile(
      shop: string,
      productId: string,
      shopifyVariantId?: string,
    ): Promise<CostProfile | null> {
      return repository.getCostProfileByTrackedProductId(
        shop,
        productId,
        normalizeShopifyVariantId(shopifyVariantId),
      );
    },

    async saveDetailedBreakdown(
      input: SaveDetailedBreakdownInput,
    ): Promise<CostProfile> {
      assertCurrency(input.currency);
      const shopifyVariantId = normalizeShopifyVariantId(input.shopifyVariantId);

      const existing = await repository.getCostProfileByTrackedProductId(
        input.shop,
        input.productId,
        shopifyVariantId,
      );

      const items = buildItemsFromAmounts(input.amounts, existing);
      const totalCost = totalCostFromItems(items);

      if (existing) {
        return repository.save({
          id: existing.id,
          shop: existing.shop,
          productId: existing.productId,
          shopifyVariantId: existing.shopifyVariantId,
          currency: existing.currency,
          mode: "DETAILED",
          totalCost,
          sellingPrice: existing.sellingPrice,
          notes: existing.notes,
          items,
        });
      }

      return repository.save({
        shop: input.shop,
        productId: input.productId,
        shopifyVariantId,
        currency: input.currency,
        mode: "DETAILED",
        totalCost,
        sellingPrice: null,
        notes: null,
        items,
      });
    },
  };
}
