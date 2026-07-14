-- CreateEnum
CREATE TYPE "MissionType" AS ENUM ('WORD', 'PRAISE', 'PRAYER');

-- CreateEnum
CREATE TYPE "CapStatus" AS ENUM ('AVAILABLE', 'CLOSED');

-- CreateEnum
CREATE TYPE "GrantStatus" AS ENUM ('PENDING', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "HelpRequestStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "groupNumber" INTEGER NOT NULL,
    "displayName" TEXT NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupRegionOrder" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "GroupRegionOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "type" "MissionType" NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "variant" TEXT,
    "isBase" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "referencePhotoUrl" TEXT,
    "judgePrompt" TEXT NOT NULL DEFAULT '기준 사진과 동일한 장소/사물이 보이는가?',
    "missionId" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 2,
    "claimedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "photoUrl" TEXT,
    "capStatus" "CapStatus" NOT NULL,
    "aiPassed" BOOLEAN,
    "aiReason" TEXT,
    "videoUrl" TEXT,
    "grantStatus" "GrantStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpRequest" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "status" "HelpRequestStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelpRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_LocationIngredients" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_LocationIngredients_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Region_name_key" ON "Region"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Group_teamId_groupNumber_key" ON "Group"("teamId", "groupNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GroupRegionOrder_groupId_regionId_key" ON "GroupRegionOrder"("groupId", "regionId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupRegionOrder_groupId_position_key" ON "GroupRegionOrder"("groupId", "position");

-- CreateIndex
CREATE INDEX "_LocationIngredients_B_index" ON "_LocationIngredients"("B");

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupRegionOrder" ADD CONSTRAINT "GroupRegionOrder_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupRegionOrder" ADD CONSTRAINT "GroupRegionOrder_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpRequest" ADD CONSTRAINT "HelpRequest_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpRequest" ADD CONSTRAINT "HelpRequest_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LocationIngredients" ADD CONSTRAINT "_LocationIngredients_A_fkey" FOREIGN KEY ("A") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LocationIngredients" ADD CONSTRAINT "_LocationIngredients_B_fkey" FOREIGN KEY ("B") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
