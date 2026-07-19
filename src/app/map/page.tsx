import { redirect } from "next/navigation";
import { getCurrentGroup } from "@/lib/group";
import { prisma } from "@/lib/prisma";
import {
  getGroupRegionProgress,
  getTeamClosedLocationIds,
} from "@/lib/region-progress";
import { getAppSettings } from "@/lib/settings";
import { MapScreen } from "@/components/MapScreen";

export default async function MapPage() {
  const group = await getCurrentGroup();
  if (!group) {
    redirect("/");
  }

  const locations = await prisma.location.findMany({
    include: { region: true },
    orderBy: [{ region: { name: "asc" } }, { name: "asc" }],
  });

  const [regionProgress, closedLocationIds, passedSubmissions, failedSubmissions, settings] =
    await Promise.all([
      getGroupRegionProgress(group.id),
      getTeamClosedLocationIds(group.teamId),
      prisma.submission.findMany({
        where: { groupId: group.id, aiPassed: true },
        include: { location: { include: { mission: true } } },
      }),
      // 실패 사유도 새로고침 후 계속 보이게 하려면 서버에서 같이 내려줘야 한다 —
      // 통과 여부와 달리 실패는 클라이언트 state에만 있어서 새로고침하면 사라졌음.
      prisma.submission.findMany({
        where: { groupId: group.id, aiPassed: false },
        orderBy: { createdAt: "desc" },
      }),
      getAppSettings(),
    ]);

  const targetRegionId =
    regionProgress.find((p) => p.status === "current")?.regionId ?? null;
  const targetRegionName =
    regionProgress.find((p) => p.status === "current")?.regionName ?? null;

  const passedByLocationId = new Map(
    passedSubmissions.map((s) => [
      s.locationId,
      {
        submissionId: s.id,
        mission: s.location.mission
          ? { type: s.location.mission.type, content: s.location.mission.content }
          : null,
        photoUrl: s.photoUrl,
        videoUrl: s.videoUrl,
        aiReason: s.aiReason,
      },
    ]),
  );

  // 실패는 여러 번 쌓일 수 있으니, locationId당 가장 최근(맨 처음 만나는) 것만 쓴다
  // (failedSubmissions가 이미 createdAt desc로 정렬돼 있음).
  const lastFailedByLocationId = new Map<string, string>();
  for (const s of failedSubmissions) {
    if (!lastFailedByLocationId.has(s.locationId)) {
      lastFailedByLocationId.set(s.locationId, s.aiReason ?? "");
    }
  }

  // 지역당 통과는 한 곳만 규칙 — 그룹이 이미 통과한 지역이면(다른 포인트라도),
  // 이 지역의 나머지 포인트에는 "여기서 이미 통과했다"는 안내만 보여준다.
  const passedByRegionId = new Map<
    string,
    { locationId: string; locationName: string; videoUploaded: boolean }
  >();
  for (const s of passedSubmissions) {
    if (!passedByRegionId.has(s.location.regionId)) {
      passedByRegionId.set(s.location.regionId, {
        locationId: s.locationId,
        locationName: s.location.name,
        videoUploaded: !!s.videoUrl,
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
      lat: loc.lat,
      lng: loc.lng,
      referencePhotoUrl: loc.referencePhotoUrl,
      isClosed: closedLocationIds.has(loc.id),
      passedInfo: passedByLocationId.get(loc.id) ?? null,
      lastFailedMessage: lastFailedByLocationId.get(loc.id) ?? null,
      regionCompletedElsewhere:
        regionPassed && regionPassed.locationId !== loc.id
          ? {
              locationName: regionPassed.locationName,
              videoUploaded: regionPassed.videoUploaded,
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
    />
  );
}
