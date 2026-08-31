import type { CostProfileRepository } from "../repositories/CostProfileRepository";
import { CostProfileValidationError } from "../errors";
import { normalizeShopifyVariantId } from "../lib/variantContext";
import type { CostProfile, OpenQuickStartInput } from "../types";
import { validateQuickStartTotalCost } from "../lib/validateQuickStartTotalCost";
import type { QuickStartService } from "./QuickStartService";

/** ISO 4217 alphabetic code — structural currency identity, not FX logic. */
const ISO_4217_CODE = /^[A-Z]{3}$/;

function assertCurrency(currency: string): void {
  if (!ISO_4217_CODE.test(currency)) {
    throw new CostProfileValidationError(
      `Currency must be a 3-letter ISO 4217 code (received "${currency}").`,
    );
  }
}

function parseQuickStartTotalCost(raw: string): string {
  const result = validateQuickStartTotalCost(raw);
  if (!result.ok) {
    throw new CostProfileValidationError(result.message);
  }
  return result.value;
}

/**
 * Application service for the Quick Start cost entry flow (PP-0012).
 */
export function createQuickStartService(
  repository: CostProfileRepository,
): QuickStartService {
  return {
    async openQuickStart(input: OpenQuickStartInput): Promise<CostProfile> {
      const shopifyVariantId = normalizeShopifyVariantId(input.shopifyVariantId);
      const existing = await repository.getCostProfileByTrackedProductId(
        input.shop,
        input.productId,
        shopifyVariantId,
      );

      if (existing) {
        return existing;
      }

      assertCurrency(input.currency);

      return repository.createQuickStartCostProfile({
        shop: input.shop,
        productId: input.productId,
        shopifyVariantId,
        currency: input.currency,
      });
    },

    async saveQuickStartCost(input: {
      shop: string;
      productId: string;
      shopifyVariantId?: string;
      totalCostRaw: string;
      currency: string;
    }): Promise<CostProfile> {
      const shopifyVariantId = normalizeShopifyVariantId(input.shopifyVariantId);
      const totalCost = parseQuickStartTotalCost(input.totalCostRaw);
      assertCurrency(input.currency);

      const existing = await repository.getCostProfileByTrackedProductId(
        input.shop,
        input.productId,
        shopifyVariantId,
      );

      if (!existing) {
        return repository.createQuickStartCostProfile({
          shop: input.shop,
          productId: input.productId,
          shopifyVariantId,
          currency: input.currency,
          totalCost,
        });
      }

      if (existing.mode !== "QUICK_START") {
        throw new CostProfileValidationError(
          "This product already has a detailed cost breakdown.",
        );
      }

      return repository.updateQuickStartCost(
        input.shop,
        input.productId,
        shopifyVariantId,
        totalCost,
      );
    },

    async getQuickStartProfile(
      shop: string,
      productId: string,
      shopifyVariantId?: string,
    ): Promise<CostProfile | null> {
      const profile = await repository.getCostProfileByTrackedProductId(
        shop,
        productId,
        normalizeShopifyVariantId(shopifyVariantId),
      );

      if (!profile || profile.mode !== "QUICK_START") {
        return null;
      }

      return profile;
    },
  };
}
