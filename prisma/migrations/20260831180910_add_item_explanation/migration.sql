-- CreateTable
CREATE TABLE "ItemExplanation" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemExplanation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemExplanation_itemId_key" ON "ItemExplanation"("itemId");

-- AddForeignKey
ALTER TABLE "ItemExplanation" ADD CONSTRAINT "ItemExplanation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
