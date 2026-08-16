-- 임원이 "확인함" 이후 참가자에게 짧게 남기는 답장 메시지.
ALTER TABLE "HelpRequest" ADD COLUMN "adminMessage" TEXT;
