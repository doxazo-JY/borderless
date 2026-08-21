-- 삭제(캡/진행 기록까지 초기화) 없이 갤러리 화면 노출만 끄기 위한 플래그.
ALTER TABLE "Submission" ADD COLUMN "hiddenInGallery" BOOLEAN NOT NULL DEFAULT false;
