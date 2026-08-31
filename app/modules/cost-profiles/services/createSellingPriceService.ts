import type { CostProfileRepository } from "../repositories/CostProfileRepository";
import {
  CostProfileNotFoundError,
  CostProfileValidationError,
} from "../errors";
import { normalizeShopifyVariantId } from "../lib/variantContext";
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
 */
export function createSellingPriceService(
  repository: CostProfileRepository,
): SellingPriceService {
  return {
    async getSellingPriceProfile(
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

    async saveSellingPrice(
      shop: string,
      productId: string,
      sellingPriceRaw: string,
      shopifyVariantId?: string,
    ): Promise<CostProfile> {
      const normalizedVariantId = normalizeShopifyVariantId(shopifyVariantId);
      const sellingPrice = parseSellingPrice(sellingPriceRaw);

      const existing = await repository.getCostProfileByTrackedProductId(
        shop,
        productId,
        normalizedVariantId,
      );

      if (!existing) {
        throw new CostProfileNotFoundError(shop, productId);
      }

      return repository.updateSellingPrice(
        shop,
        productId,
        normalizedVariantId,
        sellingPrice,
      );
    },
  };
}
