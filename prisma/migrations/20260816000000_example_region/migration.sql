-- 4지역 방문 순서/완료 로직과 분리된 데모용 "예시 포인트" 지역.
-- 어드민이 이 지역 아래에 포인트를 추가하면 GroupRegionOrder 없이도 항상 열려있다.
ALTER TABLE "Region" ADD COLUMN "isExample" BOOLEAN NOT NULL DEFAULT false;

INSERT INTO "Region" ("id", "name", "isExample")
VALUES ('example-region', 'EX', true)
ON CONFLICT ("name") DO NOTHING;
