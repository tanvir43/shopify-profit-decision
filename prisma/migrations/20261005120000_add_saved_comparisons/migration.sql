-- Saved Comparisons: reusable product + variant comparison workspaces.
-- Does not store prices, costs, Decision Strategies, or simulation results.

-- CreateTable
CREATE TABLE "SavedComparison" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedComparison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedComparisonItem" (
    "id" TEXT NOT NULL,
    "savedComparisonId" TEXT NOT NULL,
    "trackedProductId" TEXT NOT NULL,
    "shopifyVariantId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedComparisonItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedComparison_shop_idx" ON "SavedComparison"("shop");

-- CreateIndex
CREATE INDEX "SavedComparison_shop_updatedAt_idx" ON "SavedComparison"("shop", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavedComparisonItem_savedComparisonId_trackedProductId_key" ON "SavedComparisonItem"("savedComparisonId", "trackedProductId");

-- CreateIndex
CREATE INDEX "SavedComparisonItem_savedComparisonId_position_idx" ON "SavedComparisonItem"("savedComparisonId", "position");

-- CreateIndex
CREATE INDEX "SavedComparisonItem_trackedProductId_idx" ON "SavedComparisonItem"("trackedProductId");

-- AddForeignKey
ALTER TABLE "SavedComparisonItem" ADD CONSTRAINT "SavedComparisonItem_savedComparisonId_fkey" FOREIGN KEY ("savedComparisonId") REFERENCES "SavedComparison"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedComparisonItem" ADD CONSTRAINT "SavedComparisonItem_trackedProductId_fkey" FOREIGN KEY ("trackedProductId") REFERENCES "TrackedProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
