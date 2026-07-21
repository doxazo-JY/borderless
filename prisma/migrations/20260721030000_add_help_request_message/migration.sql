-- 도움 요청에 문제 설명 텍스트 + 요청한 참가자 이름(연락용) 추가
ALTER TABLE "HelpRequest" ADD COLUMN "message" TEXT;
ALTER TABLE "HelpRequest" ADD COLUMN "requesterName" TEXT;
