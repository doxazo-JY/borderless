-- 임원이 "확인함"만 눌러도 참가자에게 바로 보여주기 위한 필드. null = 미확인.
ALTER TABLE "HelpRequest" ADD COLUMN "acknowledgedAt" TIMESTAMP(3);
