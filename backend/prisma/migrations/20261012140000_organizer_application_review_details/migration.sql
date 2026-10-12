-- CreateEnum
CREATE TYPE "OrganizerType" AS ENUM ('INDIVIDUAL', 'COMPANY', 'EDUCATIONAL_INSTITUTION', 'NONPROFIT', 'OTHER');

-- CreateEnum
CREATE TYPE "OrganizerEventFrequency" AS ENUM ('ONE_TIME', 'OCCASIONALLY', 'MONTHLY', 'FREQUENTLY');

-- AlterTable
ALTER TABLE "OrganizerApplication" ADD COLUMN     "accuracyConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "agreedAt" TIMESTAMPTZ(6),
ADD COLUMN     "applicantEmail" VARCHAR(320),
ADD COLUMN     "city" VARCHAR(120),
ADD COLUMN     "contactName" VARCHAR(200),
ADD COLUMN     "contactPhone" VARCHAR(40),
ADD COLUMN     "country" VARCHAR(100),
ADD COLUMN     "eventFrequency" "OrganizerEventFrequency",
ADD COLUMN     "expectedAttendance" INTEGER,
ADD COLUMN     "experience" TEXT,
ADD COLUMN     "organizerType" "OrganizerType",
ADD COLUMN     "rulesAccepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rulesVersion" VARCHAR(40),
ADD COLUMN     "websiteUrl" VARCHAR(2048);

-- CreateTable
CREATE TABLE "OrganizerApplicationCategory" (
    "organizerApplicationId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizerApplicationCategory_pkey" PRIMARY KEY ("organizerApplicationId","categoryId")
);

-- CreateIndex
CREATE INDEX "OrganizerApplicationCategory_categoryId_organizerApplicatio_idx" ON "OrganizerApplicationCategory"("categoryId", "organizerApplicationId");

-- AddForeignKey
ALTER TABLE "OrganizerApplicationCategory" ADD CONSTRAINT "OrganizerApplicationCategory_organizerApplicationId_fkey" FOREIGN KEY ("organizerApplicationId") REFERENCES "OrganizerApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizerApplicationCategory" ADD CONSTRAINT "OrganizerApplicationCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
