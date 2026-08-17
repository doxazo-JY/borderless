-- 전체 참가자에게 한 번에 보여줄 긴급 공지 배너 문구. null/빈 문자열이면 표시 안 함.
ALTER TABLE "AppSettings" ADD COLUMN "announcementText" TEXT;
