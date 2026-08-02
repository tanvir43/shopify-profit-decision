import type { CostProfileRepository } from "../repositories/CostProfileRepository";
import {
  CostProfileNotFoundError,
  CostProfileValidationError,
} from "../errors";
import type {
  CostItem,
  CostItemInput,
  CostProfile,
  CostProfilePersist,
  EnsureCostProfileInput,
  UpdateCostProfileMetaInput,
} from "../types";
import type { CostProfileService } from "./CostProfileService";

/** ISO 4217 alphabetic code — structural currency identity, not FX logic. */
const ISO_4217_CODE = /^[A-Z]{3}$/;

function toDecisionProfile(profile: CostProfile): CostProfile {
  return {
    ...profile,
    items: profile.items.filter((item) => item.isActive),
  };
}

function toItemInputs(items: CostItem[]): CostItemInput[] {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    value: item.value,
    unit: item.unit,
    category: item.category,
    isActive: item.isActive,
    sortOrder: item.sortOrder,
    isSystem: item.isSystem,
  }));
}

function assertCurrency(currency: string): void {
  if (!ISO_4217_CODE.test(currency)) {
    throw new CostProfileValidationError(
      `Currency must be a 3-letter ISO 4217 code (received "${currency}").`,
    );
  }
}

/**
 * Resolve isSystem from existing aggregate identity so omitted flags do not
 * silently clear platform-owned lines (mapper defaults undefined → false).
 */
function normalizeReplaceItems(
  existing: CostItem[],
  items: CostItemInput[],
): CostItemInput[] {
  const existingById = new Map(existing.map((item) => [item.id, item]));

  return items.map((item) => {
    if (item.id !== undefined) {
      const prior = existingById.get(item.id);
      if (prior) {
        return {
          ...item,
          isSystem:
            item.isSystem !== undefined ? item.isSystem : prior.isSystem,
        };
      }
    }

    return {
      ...item,
      isSystem: item.isSystem ?? false,
    };
  });
}

/**
 * Aggregate-level replaceItems rules only.
 * No pricing, profit, discount, or money-range checks.
 */
function assertReplaceItemsValid(
  existing: CostItem[],
  items: CostItemInput[],
): void {
  const sortOrders = new Set<number>();
  const ids = new Set<string>();
  const businessKeys = new Set<string>();

  for (const item of items) {
    const name = item.name.trim();
    if (name.length === 0) {
      throw new CostProfileValidationError(
        "Cost item name must not be empty.",
      );
    }

    if (sortOrders.has(item.sortOrder)) {
      throw new CostProfileValidationError(
        `sortOrder values must be unique within a profile (duplicate: ${item.sortOrder}).`,
      );
    }
    sortOrders.add(item.sortOrder);

    if (item.id !== undefined) {
      if (ids.has(item.id)) {
        throw new CostProfileValidationError(
          `Duplicate cost item id in replace payload: "${item.id}".`,
        );
      }
      ids.add(item.id);
    }

    // Business definition: same label + taxonomy + unit is redundant within one profile.
    // Category alone is intentionally not unique (ADR-004).
    const businessKey = `${name.toLowerCase()}|${item.category}|${item.unit}`;
    if (businessKeys.has(businessKey)) {
      throw new CostProfileValidationError(
        `Duplicate cost item definition: "${name}" (${item.category}, ${item.unit}).`,
      );
    }
    businessKeys.add(businessKey);
  }

  const incomingById = new Map(
    items
      .filter((item): item is CostItemInput & { id: string } => item.id !== undefined)
      .map((item) => [item.id, item]),
  );

  for (const systemItem of existing.filter((item) => item.isSystem)) {
    const replacement = incomingById.get(systemItem.id);
    if (!replacement) {
      throw new CostProfileValidationError(
        `System cost item "${systemItem.name}" (${systemItem.id}) cannot be removed.`,
      );
    }
    if (replacement.isSystem !== true) {
      throw new CostProfileValidationError(
        `System cost item "${systemItem.name}" (${systemItem.id}) cannot lose isSystem.`,
      );
    }
  }

  for (const item of items) {
    if (item.isSystem === true && item.id === undefined) {
      throw new CostProfileValidationError(
        "New cost items cannot be marked isSystem; system lines are platform-owned.",
      );
    }
    if (item.id !== undefined) {
      const prior = existing.find((e) => e.id === item.id);
      if (!prior) {
        throw new CostProfileValidationError(
          `Cost item id "${item.id}" does not belong to this profile.`,
        );
      }
      if (item.isSystem === true && !prior.isSystem) {
        throw new CostProfileValidationError(
          `Cost item "${item.id}" cannot be promoted to isSystem via replaceItems.`,
        );
      }
    }
  }
}

function requireProfile(
  profile: CostProfile | null,
  shop: string,
  productId: string,
): CostProfile {
  if (!profile) {
    throw new CostProfileNotFoundError(shop, productId);
  }
  return profile;
}

/**
 * Application service for CostProfile use cases.
 *
 * Orchestrates repository access, aggregate invariants, and decision projections.
 * Does not own Prisma, HTTP, UI, or pricing math.
 */
export function createCostProfileService(
  repository: CostProfileRepository,
): CostProfileService {
  return {
    async getByProduct(shop, productId) {
      return repository.findByProduct(shop, productId);
    },

    async getDecisionProfile(shop, productId) {
      const profile = await repository.findByProduct(shop, productId);
      return profile ? toDecisionProfile(profile) : null;
    },

    async getDecisionProfiles(shop, productIds) {
      const profiles = await repository.findByProducts(shop, productIds);
      return profiles.map(toDecisionProfile);
    },

    async ensureForProduct(input: EnsureCostProfileInput) {
      const existing = await repository.findByProduct(
        input.shop,
        input.productId,
      );
      if (existing) {
        return existing;
      }

      assertCurrency(input.currency);

      const persist: CostProfilePersist = {
        shop: input.shop,
        productId: input.productId,
        currency: input.currency,
        mode: "DETAILED",
        totalCost: null,
        sellingPrice: null,
        notes: null,
        items: [],
      };

      return repository.save(persist);
    },

    async updateMeta(shop, productId, input: UpdateCostProfileMetaInput) {
      const existing = requireProfile(
        await repository.findByProduct(shop, productId),
        shop,
        productId,
      );

      const currency =
        input.currency !== undefined ? input.currency : existing.currency;
      if (input.currency !== undefined) {
        assertCurrency(input.currency);
      }

      const notes =
        input.notes !== undefined ? input.notes : existing.notes;

      return repository.save({
        id: existing.id,
        shop: existing.shop,
        productId: existing.productId,
        currency,
        mode: existing.mode,
        totalCost: existing.totalCost,
        sellingPrice: existing.sellingPrice,
        notes,
        items: toItemInputs(existing.items),
      });
    },

    async replaceItems(shop, productId, items: CostItemInput[]) {
      const existing = requireProfile(
        await repository.findByProduct(shop, productId),
        shop,
        productId,
      );

      const normalized = normalizeReplaceItems(existing.items, items);
      assertReplaceItemsValid(existing.items, normalized);

      return repository.save({
        id: existing.id,
        shop: existing.shop,
        productId: existing.productId,
        currency: existing.currency,
        mode: existing.mode,
        totalCost: existing.totalCost,
        sellingPrice: existing.sellingPrice,
        notes: existing.notes,
        items: normalized,
      });
    },
  };
}
