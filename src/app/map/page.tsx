import { redirect } from "next/navigation";
import { getCurrentGroup } from "@/lib/group";
import { prisma } from "@/lib/prisma";
import {
  getCurrentTargetRegionId,
  getTeamClosedLocationIds,
} from "@/lib/region-progress";
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

  const [targetRegionId, closedLocationIds] = await Promise.all([
    getCurrentTargetRegionId(group.id),
    getTeamClosedLocationIds(group.teamId),
  ]);

  const targetRegionName =
    locations.find((l) => l.regionId === targetRegionId)?.region.name ?? null;

  const mapLocations = locations.map((loc) => ({
    id: loc.id,
    name: loc.name,
    regionId: loc.regionId,
    regionName: loc.region.name,
    lat: loc.lat,
    lng: loc.lng,
    referencePhotoUrl: loc.referencePhotoUrl,
    isClosed: closedLocationIds.has(loc.id),
  }));

  return (
    <MapScreen
      group={{ id: group.id, displayName: group.displayName }}
      locations={mapLocations}
      targetRegionId={targetRegionId}
      targetRegionName={targetRegionName}
    />
  );
}
