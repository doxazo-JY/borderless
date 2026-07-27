-- 포인트당 미션을 1개에서 2개(슬롯1/슬롯2)로 확장 — 같은 포인트에 도착한 두 조가
-- 서로 다른 미션을 받게 해서 영상 파트가 겹치지 않게 한다.

ALTER TABLE "Location" ADD COLUMN "mission1Id" TEXT;
ALTER TABLE "Location" ADD COLUMN "mission2Id" TEXT;

-- 기존 단일 미션은 슬롯1로 이관 (데이터 보존)
UPDATE "Location" SET "mission1Id" = "missionId" WHERE "missionId" IS NOT NULL;

ALTER TABLE "Location" ADD CONSTRAINT "Location_mission1Id_fkey" FOREIGN KEY ("mission1Id") REFERENCES "Mission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Location" ADD CONSTRAINT "Location_mission2Id_fkey" FOREIGN KEY ("mission2Id") REFERENCES "Mission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Location" DROP CONSTRAINT "Location_missionId_fkey";
ALTER TABLE "Location" DROP COLUMN "missionId";

-- 이 제출이 획득한 미션 슬롯(1 또는 2) — AI 판정 통과 순서로 결정
ALTER TABLE "Submission" ADD COLUMN "missionSlot" INTEGER;
