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

export async function toggleAiJudgingDisabled() {
  const settings = await getAppSettings();
  await prisma.appSettings.update({
    where: { id: settings.id },
    data: { aiJudgingDisabled: !settings.aiJudgingDisabled },
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

// 임원이 도움 요청을 보고 직접 통과 처리 — AI 판정 API가 막혔거나(크레딧 소진 등)
// AI가 틀렸다고 판단될 때 쓰는 수동 오버라이드. 정상 판정 통과와 똑같이 캡을
// 원자적으로 차감하고 슬롯을 배정해서 미션이 공개되게 한다.
export async function passHelpRequest(formData: FormData) {
  const helpRequestId = String(formData.get("helpRequestId") ?? "");
  if (!helpRequestId) return;

  const hr = await prisma.helpRequest.findUnique({ where: { id: helpRequestId } });
  if (!hr || !hr.locationId) {
    throw new Error("장소가 지정되지 않은 요청은 통과 처리할 수 없어요.");
  }

  // 지역당 통과는 한 곳만 — 이미 같은 지역 다른 포인트에서 통과했다면 여기서도 막는다
  // (참가자 정상 흐름의 서버 검증과 같은 규칙, 안 지키면 지역 완료 집계가 깨짐).
  const location = await prisma.location.findUnique({ where: { id: hr.locationId } });
  if (!location) return;
  const passedInRegion = await prisma.submission.findFirst({
    where: {
      groupId: hr.groupId,
      aiPassed: true,
      location: { regionId: location.regionId, isActive: true },
    },
    include: { location: true },
  });
  if (passedInRegion && passedInRegion.locationId !== location.id) {
    throw new Error(
      `이 조는 이미 "${passedInRegion.location.name}"에서 이 지역을 통과했어요 — 중복 통과 처리할 수 없습니다.`,
    );
  }

  const claimed = await prisma.$queryRaw<{ claimedCount: number }[]>`
    UPDATE "Location"
    SET "claimedCount" = "claimedCount" + 1
    WHERE id = ${location.id} AND "claimedCount" < capacity
    RETURNING "claimedCount"
  `;
  if (claimed.length === 0) {
    throw new Error("이미 마감된 포인트라 통과 처리할 수 없어요 — 초기화 후 다시 시도하세요.");
  }

  await prisma.submission.create({
    data: {
      groupId: hr.groupId,
      locationId: location.id,
      capStatus: "AVAILABLE",
      aiPassed: true,
      aiReason: "임원 확인 후 통과 처리되었습니다.",
      grantStatus: "PENDING",
      missionSlot: claimed[0].claimedCount,
    },
  });

  await prisma.helpRequest.update({ where: { id: hr.id }, data: { status: "RESOLVED" } });
  refresh();
}

// 임원이 사진을 확인했는데 실제로 기준과 다를 때 — 사유를 남겨서 AI가 실패시켰을
// 때와 같은 화면(사유 + 재시도)이 조에게 뜨도록 한다. 캡은 건드리지 않는다.
export async function failHelpRequest(formData: FormData) {
  const helpRequestId = String(formData.get("helpRequestId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!helpRequestId || !reason) return;

  const hr = await prisma.helpRequest.findUnique({ where: { id: helpRequestId } });
  if (!hr || !hr.locationId) return;

  await prisma.submission.create({
    data: {
      groupId: hr.groupId,
      locationId: hr.locationId,
      capStatus: "AVAILABLE",
      aiPassed: false,
      aiReason: reason,
    },
  });

  await prisma.helpRequest.update({ where: { id: hr.id }, data: { status: "RESOLVED" } });
  refresh();
}
