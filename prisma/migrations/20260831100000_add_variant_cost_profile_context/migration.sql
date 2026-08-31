-- Variant-level cost profile context (PP-variant-selection)
-- shopifyVariantId = '' preserves existing product-level profiles (backward compatible).

ALTER TABLE "CostProfile" ADD COLUMN "shopifyVariantId" TEXT NOT NULL DEFAULT '';

DROP INDEX "CostProfile_shop_productId_key";

CREATE UNIQUE INDEX "CostProfile_shop_productId_shopifyVariantId_key" ON "CostProfile"("shop", "productId", "shopifyVariantId");

ALTER TABLE "TrackedProduct" ADD COLUMN "selectedShopifyVariantId" TEXT;
