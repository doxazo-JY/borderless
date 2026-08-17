"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { publicPhotoUrl } from "@/lib/storage";

const GALLERY_PATH = `/admin/${process.env.ADMIN_SECRET_PATH}/gallery`;

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

  revalidatePath(GALLERY_PATH);
}
