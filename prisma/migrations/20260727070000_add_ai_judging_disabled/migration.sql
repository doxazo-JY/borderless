-- AI 판정 API가 막혔을 때 임원이 켜는 스위치 — 참가자 화면에 상시 배너 표시용
ALTER TABLE "AppSettings" ADD COLUMN "aiJudgingDisabled" BOOLEAN NOT NULL DEFAULT false;
