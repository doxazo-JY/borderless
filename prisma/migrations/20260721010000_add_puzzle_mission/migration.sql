-- 4번째 미션 유형(PUZZLE, "문제") 추가: 영상 업로드 대신 정답 텍스트 제출로 완료 처리
ALTER TYPE "MissionType" ADD VALUE 'PUZZLE';

ALTER TABLE "Mission" ADD COLUMN "answer" TEXT;

ALTER TABLE "Submission" ADD COLUMN "answerText" TEXT;
ALTER TABLE "Submission" ADD COLUMN "answerCorrect" BOOLEAN NOT NULL DEFAULT false;
