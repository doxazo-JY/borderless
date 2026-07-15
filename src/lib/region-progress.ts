import { prisma } from "@/lib/prisma";

export async function getCurrentTargetRegionId(
  groupId: string,
): Promise<string | null> {
  const order = await prisma.groupRegionOrder.findMany({
    where: { groupId },
    orderBy: { position: "asc" },
  });

  const passed = await prisma.submission.findMany({
    where: { groupId, aiPassed: true },
    select: { location: { select: { regionId: true } } },
  });
  const passedRegionIds = new Set(passed.map((s) => s.location.regionId));

  const next = order.find((o) => !passedRegionIds.has(o.regionId));
  return next?.regionId ?? null;
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
