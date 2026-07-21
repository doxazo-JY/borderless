-- 조원 이름을 참가자가 매번 입력하는 대신 어드민이 미리 등록해두는 방식으로 전환
ALTER TABLE "Group" ADD COLUMN "memberName1" TEXT;
ALTER TABLE "Group" ADD COLUMN "memberName2" TEXT;
