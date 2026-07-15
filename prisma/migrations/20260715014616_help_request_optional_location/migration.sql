-- DropForeignKey
ALTER TABLE "HelpRequest" DROP CONSTRAINT "HelpRequest_locationId_fkey";

-- AlterTable
ALTER TABLE "HelpRequest" ALTER COLUMN "locationId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "HelpRequest" ADD CONSTRAINT "HelpRequest_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
