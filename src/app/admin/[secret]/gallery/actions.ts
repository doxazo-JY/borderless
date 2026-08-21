"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { publicPhotoUrl } from "@/lib/storage";

const GALLERY_PATH = `/admin/${process.env.ADMIN_SECRET_PATH}/gallery`;

// 어드민 갤러리와 공유용 /gallery/[secret] 링크가 같은 데이터를 보여주므로,
// 둘 다 갱신해야 방금 한 변경이 바로 반영된다.
function refreshGalleryPages() {
  revalidatePath(GALLERY_PATH);
  revalidatePath("/gallery/[secret]", "page");
}

// 현장에서 영상 업로드가 실패해서 임시로 짧은 영상을 올리고 통과시킨 제출들을,
// 행사 후 실제 촬영본으로 갈아끼우기 위한 기능. 영상 바이트는 (다른 업로드들과
// 마찬가지로) 브라우저가 Storage에 직접 올리고, 여기엔 결과 경로만 온다.
export async function replaceSubmissionVideo(submissionId: string, videoPath: string) {
  if (!submissionId || !videoPath) return;

  const videoUrl = publicPhotoUrl(videoPath);
  await prisma.submission.update({
    where: { id: submissionId },
    data: { videoUrl },
  });

  refreshGalleryPages();
}

// 삭제(캡/진행 기록까지 초기화)하지 않고 갤러리 화면 노출만 켜고 끈다 — 완성
// 영상 몰아보기에 넣기엔 부적절한 촬영본을 빼고 싶을 때 쓰는 용도.
export async function setSubmissionGalleryHidden(submissionId: string, hidden: boolean) {
  if (!submissionId) return;

  await prisma.submission.update({
    where: { id: submissionId },
    data: { hiddenInGallery: hidden },
  });

  refreshGalleryPages();
}
