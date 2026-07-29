-- CreateEnum
CREATE TYPE "CostUnit" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "CostCategory" AS ENUM ('PRODUCT', 'PACKAGING', 'SHIPPING', 'TRANSACTION', 'CUSTOM');

-- CreateTable
CREATE TABLE "CostProfile" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostItem" (
    "id" TEXT NOT NULL,
    "costProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DECIMAL(19,6) NOT NULL,
    "unit" "CostUnit" NOT NULL,
    "category" "CostCategory" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackedProduct" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "trackedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackedProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CostProfile_shop_idx" ON "CostProfile"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "CostProfile_shop_productId_key" ON "CostProfile"("shop", "productId");

-- CreateIndex
CREATE INDEX "CostItem_costProfileId_sortOrder_idx" ON "CostItem"("costProfileId", "sortOrder");

-- CreateIndex
CREATE INDEX "CostItem_costProfileId_isActive_idx" ON "CostItem"("costProfileId", "isActive");

-- CreateIndex
CREATE INDEX "CostItem_category_idx" ON "CostItem"("category");

-- CreateIndex
CREATE INDEX "TrackedProduct_shopId_idx" ON "TrackedProduct"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedProduct_shopId_shopifyProductId_key" ON "TrackedProduct"("shopId", "shopifyProductId");

-- AddForeignKey
ALTER TABLE "CostItem" ADD CONSTRAINT "CostItem_costProfileId_fkey" FOREIGN KEY ("costProfileId") REFERENCES "CostProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
