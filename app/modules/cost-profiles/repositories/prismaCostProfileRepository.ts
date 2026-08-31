import type { PrismaClient } from "@prisma/client";
import type { CostProfileMapper } from "../mappers/costProfileMapper";
import {
  normalizeShopifyVariantId,
  PRODUCT_LEVEL_VARIANT_ID,
} from "../lib/variantContext";
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

function profileUniqueWhere(
  shop: string,
  productId: string,
  shopifyVariantId: string,
) {
  return {
    shop_productId_shopifyVariantId: {
      shop,
      productId,
      shopifyVariantId: normalizeShopifyVariantId(shopifyVariantId),
    },
  };
}

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
      return this.findByProductAndVariant(
        shop,
        productId,
        PRODUCT_LEVEL_VARIANT_ID,
      );
    },

    async findByProductAndVariant(
      shop: string,
      productId: string,
      shopifyVariantId: string,
    ): Promise<CostProfile | null> {
      const row = await prisma.costProfile.findUnique({
        where: profileUniqueWhere(shop, productId, shopifyVariantId),
        include: profileWithItems,
      });

      return row ? mapper.toDomain(row) : null;
    },

    async findAllForProduct(
      shop: string,
      productId: string,
    ): Promise<CostProfile[]> {
      const rows = await prisma.costProfile.findMany({
        where: { shop, productId },
        include: profileWithItems,
      });

      return rows.map((row) => mapper.toDomain(row));
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

      const row = await prisma.costProfile.upsert({
        where: profileUniqueWhere(data.shop, data.productId, data.shopifyVariantId),
        create: {
          shop: data.shop,
          productId: data.productId,
          shopifyVariantId: data.shopifyVariantId,
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
      shopifyVariantId: string = PRODUCT_LEVEL_VARIANT_ID,
    ): Promise<CostProfile | null> {
      return this.findByProductAndVariant(shop, productId, shopifyVariantId);
    },

    async createQuickStartCostProfile(
      input: CreateQuickStartCostProfileInput,
    ): Promise<CostProfile> {
      const shopifyVariantId = normalizeShopifyVariantId(input.shopifyVariantId);
      const row = await prisma.costProfile.create({
        data: {
          shop: input.shop,
          productId: input.productId,
          shopifyVariantId,
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
      shopifyVariantId: string,
      totalCost: string,
    ): Promise<CostProfile> {
      const row = await prisma.costProfile.update({
        where: profileUniqueWhere(shop, productId, shopifyVariantId),
        data: { totalCost },
        include: profileWithItems,
      });

      return mapper.toDomain(row);
    },

    async updateSellingPrice(
      shop: string,
      productId: string,
      shopifyVariantId: string,
      sellingPrice: string,
    ): Promise<CostProfile> {
      const row = await prisma.costProfile.update({
        where: profileUniqueWhere(shop, productId, shopifyVariantId),
        data: { sellingPrice },
        include: profileWithItems,
      });

      return mapper.toDomain(row);
    },
  };
}
