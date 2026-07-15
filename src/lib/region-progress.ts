import { prisma } from "@/lib/prisma";

export type RegionProgressItem = {
  regionId: string;
  regionName: string;
  status: "done" | "current" | "upcoming";
};

/** 그룹의 지역 방문 순서를 진행 상태(완료/현재/예정)와 함께 반환 — 진행 스테퍼용 */
export async function getGroupRegionProgress(
  groupId: string,
): Promise<RegionProgressItem[]> {
  const order = await prisma.groupRegionOrder.findMany({
    where: { groupId },
    orderBy: { position: "asc" },
    include: { region: true },
  });

  // 사진 판정 통과만으로는 지역이 "완료"되지 않는다 — 미션 영상 업로드까지 끝나야
  // 다음 지역으로 넘어간다(그 전까지 상단 진행 표시/차례는 이 지역에 그대로 머문다).
  const passed = await prisma.submission.findMany({
    where: { groupId, aiPassed: true, videoUrl: { not: null } },
    select: { location: { select: { regionId: true } } },
  });
  const passedRegionIds = new Set(passed.map((s) => s.location.regionId));

  let currentAssigned = false;
  return order.map((o) => {
    if (passedRegionIds.has(o.regionId)) {
      return { regionId: o.regionId, regionName: o.region.name, status: "done" as const };
    }
    if (!currentAssigned) {
      currentAssigned = true;
      return { regionId: o.regionId, regionName: o.region.name, status: "current" as const };
    }
    return { regionId: o.regionId, regionName: o.region.name, status: "upcoming" as const };
  });
}

export async function getCurrentTargetRegionId(
  groupId: string,
): Promise<string | null> {
  const progress = await getGroupRegionProgress(groupId);
  return progress.find((p) => p.status === "current")?.regionId ?? null;
}

/** 같은 팀(다른 조 포함) 기준으로 마감 확인된 location id 집합 */
export async function getTeamClosedLocationIds(
  teamId: string,
): Promise<Set<string>> {
  const groups = await prisma.group.findMany({
    where: { teamId },
    select: { id: true },
  });
  const groupIds = groups.map((g) => g.id);

  const closed = await prisma.submission.findMany({
    where: { groupId: { in: groupIds }, capStatus: "CLOSED" },
    select: { locationId: true },
    distinct: ["locationId"],
  });

  return new Set(closed.map((c) => c.locationId));
}
