-- 퀴즈(PUZZLE) 미션 타입을 고백(CONFESSION)으로 교체하고, 그 전용이던 정답
-- 입력/채점 기능(Mission.answer, Submission.answerText/answerCorrect)을 완전히
-- 정리한다. 적용 시점 기준 프로덕션 DB에 PUZZLE 미션/정답 제출 데이터가 없음을
-- 확인했다 (2026-07-27).

ALTER TYPE "MissionType" RENAME TO "MissionType_old";
CREATE TYPE "MissionType" AS ENUM ('WORD', 'PRAISE', 'PRAYER', 'CONFESSION');
ALTER TABLE "Mission" ALTER COLUMN "type" TYPE "MissionType" USING ("type"::text::"MissionType");
DROP TYPE "MissionType_old";

ALTER TABLE "Mission" DROP COLUMN "answer";
ALTER TABLE "Submission" DROP COLUMN "answerText";
ALTER TABLE "Submission" DROP COLUMN "answerCorrect";
