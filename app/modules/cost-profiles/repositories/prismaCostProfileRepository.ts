import type { PrismaClient } from "@prisma/client";
import type { CostProfileMapper } from "../mappers/costProfileMapper";
import {
  prismaCostProfileMapper,
  type CostItemWriteModel,
  type CostProfileWriteModel,
} from "../mappers/prismaCostProfileMapper";
import type {
  CostProfile,
  CostProfilePersist,
  CreateQuickStartCostProfileInput,
} from "../types";
import type { CostProfileRepository } from "./CostProfileRepository";

const profileWithItems = {
  items: {
    orderBy: { sortOrder: "asc" as const },
  },
};

function toItemCreateInput(item: CostItemWriteModel) {
  return {
    ...(item.id !== undefined ? { id: item.id } : {}),
    name: item.name,
    value: item.value,
    unit: item.unit,
    category: item.category,
    isActive: item.isActive,
    sortOrder: item.sortOrder,
    isSystem: item.isSystem,
  };
}

/**
 * Prisma implementation of CostProfileRepository.
 *
 * Owns query verbs only. Domain ↔ storage field conversion is delegated to
 * CostProfileMapper so a future persistence swap replaces this file + mapper.
 */
export function createPrismaCostProfileRepository(
  prisma: PrismaClient,
  mapper: CostProfileMapper = prismaCostProfileMapper,
): CostProfileRepository {
  return {
    async findByProduct(
      shop: string,
      productId: string,
    ): Promise<CostProfile | null> {
      const row = await prisma.costProfile.findUnique({
        where: { shop_productId: { shop, productId } },
        include: profileWithItems,
      });

      return row ? mapper.toDomain(row) : null;
    },

    async findByProducts(
      shop: string,
      productIds: string[],
    ): Promise<CostProfile[]> {
      if (productIds.length === 0) {
        return [];
      }

      const rows = await prisma.costProfile.findMany({
        where: {
          shop,
          productId: { in: productIds },
        },
        include: profileWithItems,
      });

      return rows.map((row) => mapper.toDomain(row));
    },

    async save(profile: CostProfilePersist): Promise<CostProfile> {
      const data = mapper.toPersist(profile) as CostProfileWriteModel;
      const itemCreates = data.items.map(toItemCreateInput);

      // Full aggregate replace: nested deleteMany + create runs in one Prisma
      // nested-write transaction — no explicit $transaction required.
      const row = await prisma.costProfile.upsert({
        where: {
          shop_productId: {
            shop: data.shop,
            productId: data.productId,
          },
        },
        create: {
          shop: data.shop,
          productId: data.productId,
          currency: data.currency,
          mode: data.mode,
          totalCost: data.totalCost,
          sellingPrice: data.sellingPrice,
          notes: data.notes,
          items: { create: itemCreates },
        },
        update: {
          currency: data.currency,
          mode: data.mode,
          totalCost: data.totalCost,
          sellingPrice: data.sellingPrice,
          notes: data.notes,
          items: {
            deleteMany: {},
            create: itemCreates,
          },
        },
        include: profileWithItems,
      });

      return mapper.toDomain(row);
    },

    async getCostProfileByTrackedProductId(
      shop: string,
      productId: string,
    ): Promise<CostProfile | null> {
      const row = await prisma.costProfile.findUnique({
        where: { shop_productId: { shop, productId } },
        include: profileWithItems,
      });

      return row ? mapper.toDomain(row) : null;
    },

    async createQuickStartCostProfile(
      input: CreateQuickStartCostProfileInput,
    ): Promise<CostProfile> {
      const row = await prisma.costProfile.create({
        data: {
          shop: input.shop,
          productId: input.productId,
          currency: input.currency,
          mode: "QUICK_START",
          totalCost: input.totalCost ?? null,
          notes: null,
        },
        include: profileWithItems,
      });

      return mapper.toDomain(row);
    },

    async updateQuickStartCost(
      shop: string,
      productId: string,
      totalCost: string,
    ): Promise<CostProfile> {
      const row = await prisma.costProfile.update({
        where: { shop_productId: { shop, productId } },
        data: { totalCost },
        include: profileWithItems,
      });

      return mapper.toDomain(row);
    },

    async updateSellingPrice(
      shop: string,
      productId: string,
      sellingPrice: string,
    ): Promise<CostProfile> {
      const row = await prisma.costProfile.update({
        where: { shop_productId: { shop, productId } },
        data: { sellingPrice },
        include: profileWithItems,
      });

      return mapper.toDomain(row);
    },
  };
}
