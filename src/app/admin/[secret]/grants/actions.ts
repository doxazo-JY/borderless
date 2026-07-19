"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function confirmGrant(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const secret = String(formData.get("secret") ?? "");
  if (!id) return;

  await prisma.submission.update({
    where: { id },
    data: { grantStatus: "CONFIRMED", confirmedAt: new Date() },
  });

  revalidatePath(`/admin/${secret}/grants`);
}

// 잘못 올라간 사진/영상이나 테스트 제출을 지워서, 그 그룹이 이 포인트를 다시 시도할
// 수 있게 한다. 캡은 판정 통과 시점에 이미 차감돼 있으므로 함께 되돌려준다.
export async function resetSubmission(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const secret = String(formData.get("secret") ?? "");
  if (!id) return;

  const submission = await prisma.submission.findUnique({ where: { id } });
  if (!submission) return;

  await prisma.submission.delete({ where: { id } });

  if (submission.aiPassed && submission.capStatus === "AVAILABLE") {
    await prisma.location.update({
      where: { id: submission.locationId },
      data: { claimedCount: { decrement: 1 } },
    });
  }

  revalidatePath(`/admin/${secret}/grants`);
  revalidatePath(`/admin/${secret}/dashboard`);
}
