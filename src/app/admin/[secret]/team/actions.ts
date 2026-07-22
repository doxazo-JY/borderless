"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";

const TEAM_PATH = `/admin/${process.env.ADMIN_SECRET_PATH}/team`;

function refresh() {
  revalidatePath(TEAM_PATH);
}

export async function toggleGroupSelectionLock() {
  const settings = await getAppSettings();
  await prisma.appSettings.update({
    where: { id: settings.id },
    data: { groupSelectionLocked: !settings.groupSelectionLocked },
  });
  refresh();
}

export async function updateGroupMembers(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const memberName1 = String(formData.get("memberName1") ?? "").trim() || null;
  const memberName2 = String(formData.get("memberName2") ?? "").trim() || null;

  await prisma.group.update({
    where: { id },
    data: { memberName1, memberName2 },
  });
  refresh();
}

export async function setGroupRegionOrder(formData: FormData) {
  const groupId = String(formData.get("groupId") ?? "");
  const regionIds = formData.getAll("regionOrder").map(String);
  if (!groupId || regionIds.length === 0) return;

  await prisma.$transaction([
    prisma.groupRegionOrder.deleteMany({ where: { groupId } }),
    ...regionIds.map((regionId, position) =>
      prisma.groupRegionOrder.create({
        data: { groupId, regionId, position },
      }),
    ),
  ]);

  refresh();
}

export async function confirmGrant(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.submission.update({
    where: { id },
    data: { grantStatus: "CONFIRMED", confirmedAt: new Date() },
  });

  refresh();
}

// 잘못 올라간 사진/영상이나 테스트 제출을 지워서, 그 그룹이 이 포인트를 다시 시도할
// 수 있게 한다. 캡은 판정 통과 시점에 이미 차감돼 있으므로 함께 되돌려준다.
export async function resetSubmission(formData: FormData) {
  const id = String(formData.get("id") ?? "");
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

  refresh();
}

// 답사/리허설 중 쌓인 테스트 제출/도움 요청을 한 번에 지우기 위한 전체 초기화 —
// 모든 그룹의 제출 기록과 도움 요청(테스트용 이름 포함)을 지우고 포인트별 캡도
// 전부 0으로 되돌린다. 미션/재료/장소/그룹 같은 설정 데이터는 건드리지 않는다.
// 참가자 이름은 각 기기 쿠키에만 있어서 여기서 지울 수 없다 — 테스트에 쓴 기기는
// 지도 화면의 "그룹 변경"으로 각자 따로 초기화해야 한다.
export async function resetAllSubmissions() {
  await prisma.$transaction([
    prisma.submission.deleteMany({}),
    prisma.helpRequest.deleteMany({}),
    prisma.location.updateMany({ data: { claimedCount: 0 } }),
  ]);

  refresh();
}

export async function resolveHelpRequest(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.helpRequest.update({
    where: { id },
    data: { status: "RESOLVED" },
  });

  refresh();
}
