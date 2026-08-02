import type { CostProfileRepository } from "../repositories/CostProfileRepository";
import {
  CostProfileNotFoundError,
  CostProfileValidationError,
} from "../errors";
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
      const existing = await repository.getCostProfileByTrackedProductId(
        input.shop,
        input.productId,
      );

      if (existing) {
        return existing;
      }

      assertCurrency(input.currency);

      return repository.createQuickStartCostProfile({
        shop: input.shop,
        productId: input.productId,
        currency: input.currency,
      });
    },

    async saveQuickStartCost(
      shop: string,
      productId: string,
      totalCostRaw: string,
    ): Promise<CostProfile> {
      const totalCost = parseQuickStartTotalCost(totalCostRaw);

      const existing = await repository.getCostProfileByTrackedProductId(
        shop,
        productId,
      );

      if (!existing) {
        throw new CostProfileNotFoundError(shop, productId);
      }

      return repository.updateQuickStartCost(shop, productId, totalCost);
    },

    async getQuickStartProfile(
      shop: string,
      productId: string,
    ): Promise<CostProfile | null> {
      const profile = await repository.getCostProfileByTrackedProductId(
        shop,
        productId,
      );

      if (!profile || profile.mode !== "QUICK_START") {
        return null;
      }

      return profile;
    },
  };
}
