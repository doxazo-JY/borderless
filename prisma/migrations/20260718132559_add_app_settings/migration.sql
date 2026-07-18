-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL,
    "groupSelectionLocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);
