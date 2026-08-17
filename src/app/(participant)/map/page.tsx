import { redirect } from "next/navigation";
import { getCurrentGroup } from "@/lib/group";
import { prisma } from "@/lib/prisma";
import {
  getGroupRegionProgress,
  getTeamClosedLocationIds,
  getTeammatesRegionProgress,
} from "@/lib/region-progress";
import { getAppSettings } from "@/lib/settings";
import { MapScreen } from "@/components/MapScreen";

export default async function MapPage() {
  const group = await getCurrentGroup();
  if (!group) {
    redirect("/");
  }

  const locations = await prisma.location.findMany({
    where: { isActive: true },
    include: { region: true },
    orderBy: [{ region: { name: "asc" } }, { name: "asc" }],
  });

  const [
    regionProgress,
    closedLocationIds,
    passedSubmissions,
    failedSubmissions,
    teammateSubmissions,
    settings,
    teammatesRegionProgress,
  ] = await Promise.all([
    getGroupRegionProgress(group.id),
    getTeamClosedLocationIds(group.teamId),
    prisma.submission.findMany({
      where: { groupId: group.id, aiPassed: true, location: { isActive: true } },
      include: {
        location: { include: { mission1: true, mission2: true, ingredients: true } },
      },
    }),
    // 실패 사유도 새로고침 후 계속 보이게 하려면 서버에서 같이 내려줘야 한다 —
    // 통과 여부와 달리 실패는 클라이언트 state에만 있어서 새로고침하면 사라졌음.
    prisma.submission.findMany({
      where: { groupId: group.id, aiPassed: false, location: { isActive: true } },
      orderBy: { createdAt: "desc" },
    }),
    // 같은 팀 다른 조가 이미 통과한 지역을 알려주기 위한 조회 — 팀 밖으로는
    // 절대 안 새어나가야 하므로 group.teamId로만 필터링한다.
    prisma.submission.findMany({
      where: {
        aiPassed: true,
        location: { isActive: true },
        group: { teamId: group.teamId, id: { not: group.id } },
      },
      include: { group: true, location: true },
    }),
    getAppSettings(),
    getTeammatesRegionProgress(group.teamId, group.id),
  ]);

  // 펜션 마커 클릭 시 "우리 조 현황"에 보여줄 지금까지 모은 재료 — 이름 기준 중복 제거.
  const earnedIngredients = Array.from(
    new Map(
      passedSubmissions.flatMap((s) =>
        s.location.ingredients.map((ing) => [ing.id, { id: ing.id, name: ing.name }] as const),
      ),
    ).values(),
  );

  const targetRegionId =
    regionProgress.find((p) => p.status === "current")?.regionId ?? null;
  const targetRegionName =
    regionProgress.find((p) => p.status === "current")?.regionName ?? null;

  // 이 제출이 어느 슬롯을 받았는지에 따라 실제로 부여된 미션을 고른다
  // (같은 포인트라도 먼저/나중에 통과한 조는 서로 다른 미션을 받는다).
  function resolveMission(s: (typeof passedSubmissions)[number]) {
    return s.missionSlot === 2 ? s.location.mission2 : s.location.mission1;
  }

  const passedByLocationId = new Map(
    passedSubmissions.map((s) => {
      const mission = resolveMission(s);
      return [
        s.locationId,
        {
          submissionId: s.id,
          mission: mission
            ? {
                type: mission.type,
                content: mission.content,
                imageUrl: mission.imageUrl,
              }
            : null,
          photoUrl: s.photoUrl,
          videoUrl: s.videoUrl,
          aiReason: s.aiReason,
        },
      ] as const;
    }),
  );

  // 실패는 여러 번 쌓일 수 있으니, locationId당 가장 최근(맨 처음 만나는) 것만 쓴다
  // (failedSubmissions가 이미 createdAt desc로 정렬돼 있음). 사진도 같이 내려줘서
  // 새로고침 후에도 뭘 올렸었는지 계속 보이게 한다.
  const lastFailedByLocationId = new Map<
    string,
    { message: string; photoUrl: string | null }
  >();
  for (const s of failedSubmissions) {
    if (!lastFailedByLocationId.has(s.locationId)) {
      lastFailedByLocationId.set(s.locationId, {
        message: s.aiReason ?? "",
        photoUrl: s.photoUrl,
      });
    }
  }

  // 지역당 통과는 한 곳만 규칙 — 그룹이 이미 통과한 지역이면(다른 포인트라도),
  // 이 지역의 나머지 포인트에는 "여기서 이미 통과했다"는 안내만 보여준다.
  const passedByRegionId = new Map<
    string,
    { locationId: string; locationName: string; completed: boolean }
  >();
  for (const s of passedSubmissions) {
    if (!passedByRegionId.has(s.location.regionId)) {
      passedByRegionId.set(s.location.regionId, {
        locationId: s.locationId,
        locationName: s.location.name,
        completed: !!s.videoUrl,
      });
    }
  }

  // 같은 팀 다른 조가 그 지역을 어디서든 이미 통과했으면 지역당 하나만 기억한다
  // (여러 조가 겹쳐도 첫 번째만 안내) — 이 그룹 자신의 진행에는 영향 없는 순수 안내용.
  const teammatePassedByRegionId = new Map<
    string,
    { groupDisplayName: string; locationName: string }
  >();
  for (const s of teammateSubmissions) {
    if (!teammatePassedByRegionId.has(s.location.regionId)) {
      teammatePassedByRegionId.set(s.location.regionId, {
        groupDisplayName: s.group.displayName,
        locationName: s.location.name,
      });
    }
  }

  const mapLocations = locations.map((loc) => {
    const regionPassed = passedByRegionId.get(loc.regionId);
    return {
      id: loc.id,
      name: loc.name,
      regionId: loc.regionId,
      regionName: loc.region.name,
      regionIsExample: loc.region.isExample,
      lat: loc.lat,
      lng: loc.lng,
      referencePhotoUrl: loc.referencePhotoUrl,
      isClosed: closedLocationIds.has(loc.id),
      passedInfo: passedByLocationId.get(loc.id) ?? null,
      lastFailedInfo: lastFailedByLocationId.get(loc.id) ?? null,
      teammateProgress: teammatePassedByRegionId.get(loc.regionId) ?? null,
      regionCompletedElsewhere:
        regionPassed && regionPassed.locationId !== loc.id
          ? {
              locationName: regionPassed.locationName,
              completed: regionPassed.completed,
            }
          : null,
    };
  });

  return (
    <MapScreen
      group={{
        id: group.id,
        displayName: group.displayName,
        teamName: group.team.name,
      }}
      locations={mapLocations}
      regionProgress={regionProgress}
      targetRegionId={targetRegionId}
      targetRegionName={targetRegionName}
      groupSelectionLocked={settings.groupSelectionLocked}
      aiJudgingDisabled={settings.aiJudgingDisabled}
      announcementText={settings.announcementText}
      earnedIngredients={earnedIngredients}
      teammatesRegionProgress={teammatesRegionProgress}
    />
  );
}
