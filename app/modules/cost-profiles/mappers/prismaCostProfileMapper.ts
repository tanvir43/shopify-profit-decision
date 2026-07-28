import type { CostItem as PrismaCostItem, CostProfile as PrismaCostProfile } from "@prisma/client";
import type { CostCategory } from "../types/CostCategory";
import type { CostItem } from "../types/CostItem";
import type { CostItemInput, CostProfilePersist } from "../types/CostProfileInputs";
import type { CostProfile } from "../types/CostProfile";
import type { CostUnit } from "../types/CostUnit";
import type { CostProfileMapper } from "./costProfileMapper";

type PrismaCostProfileWithItems = PrismaCostProfile & {
  items: PrismaCostItem[];
};

/**
 * Storage-ready write model. Field shapes are persistence-neutral enough that
 * the Prisma repository can assemble queries without re-converting Decimals/enums.
 */
export type CostProfileWriteModel = {
  shop: string;
  productId: string;
  currency: string;
  notes: string | null;
  items: CostItemWriteModel[];
};

export type CostItemWriteModel = {
  id?: string;
  name: string;
  value: string;
  unit: CostUnit;
  category: CostCategory;
  isActive: boolean;
  sortOrder: number;
  isSystem: boolean;
};

function decimalToString(value: { toString(): string }): string {
  return value.toString();
}

function toItemWriteModel(item: CostItemInput): CostItemWriteModel {
  const writeItem: CostItemWriteModel = {
    name: item.name,
    value: item.value,
    unit: item.unit,
    category: item.category,
    isActive: item.isActive,
    sortOrder: item.sortOrder,
    // Persistence mapping of optional flag → stored boolean (schema default).
    // Not business "default item creation".
    isSystem: item.isSystem ?? false,
  };

  if (item.id !== undefined) {
    writeItem.id = item.id;
  }

  return writeItem;
}

export const prismaCostProfileMapper: CostProfileMapper = {
  toDomain(prismaProfile: unknown): CostProfile {
    const profile = prismaProfile as PrismaCostProfileWithItems;

    return {
      id: profile.id,
      shop: profile.shop,
      productId: profile.productId,
      currency: profile.currency,
      notes: profile.notes,
      items: profile.items.map((item) =>
        prismaCostProfileMapper.toDomainItem(item),
      ),
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  },

  toDomainItem(prismaItem: unknown): CostItem {
    const item = prismaItem as PrismaCostItem;

    return {
      id: item.id,
      name: item.name,
      value: decimalToString(item.value),
      unit: item.unit,
      category: item.category,
      isActive: item.isActive,
      sortOrder: item.sortOrder,
      isSystem: item.isSystem,
    };
  },

  toPersist(profile: CostProfilePersist): CostProfileWriteModel {
    return {
      shop: profile.shop,
      productId: profile.productId,
      currency: profile.currency,
      notes: profile.notes,
      items: profile.items.map(toItemWriteModel),
    };
  },
};
