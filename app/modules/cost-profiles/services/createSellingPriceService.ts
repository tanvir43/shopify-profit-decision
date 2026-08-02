import type { CostProfileRepository } from "../repositories/CostProfileRepository";
import {
  CostProfileNotFoundError,
  CostProfileValidationError,
} from "../errors";
import type { CostProfile } from "../types";
import { validateSellingPrice } from "../lib/validateSellingPrice";
import type { SellingPriceService } from "./SellingPriceService";

function parseSellingPrice(raw: string): string {
  const result = validateSellingPrice(raw);
  if (!result.ok) {
    throw new CostProfileValidationError(result.message);
  }
  return result.value;
}

/**
 * Application service for selling price entry.
 * Collects and persists merchant selling price only — no calculations.
 */
export function createSellingPriceService(
  repository: CostProfileRepository,
): SellingPriceService {
  return {
    async getSellingPriceProfile(
      shop: string,
      productId: string,
    ): Promise<CostProfile | null> {
      return repository.getCostProfileByTrackedProductId(shop, productId);
    },

    async saveSellingPrice(
      shop: string,
      productId: string,
      sellingPriceRaw: string,
    ): Promise<CostProfile> {
      const sellingPrice = parseSellingPrice(sellingPriceRaw);

      const existing = await repository.getCostProfileByTrackedProductId(
        shop,
        productId,
      );

      if (!existing) {
        throw new CostProfileNotFoundError(shop, productId);
      }

      return repository.updateSellingPrice(shop, productId, sellingPrice);
    },
  };
}
