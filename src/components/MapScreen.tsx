"use client";

import { useState } from "react";
import Link from "next/link";
import { KakaoMap } from "@/components/KakaoMap";
import { LocationPanel } from "@/components/LocationPanel";
import { clearGroup } from "@/app/actions";
import { teamColor } from "@/lib/team-colors";

export type MapLocationInfo = {
  id: string;
  name: string;
  regionId: string;
  regionName: string;
  lat: number;
  lng: number;
  referencePhotoUrl: string | null;
  isClosed: boolean;
};

export function MapScreen({
  group,
  locations,
  targetRegionId,
  targetRegionName,
}: {
  group: { id: string; displayName: string; teamName: string };
  locations: MapLocationInfo[];
  targetRegionId: string | null;
  targetRegionName: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedLocation = locations.find((l) => l.id === selectedId) ?? null;

  return (
    <main className="flex flex-1 flex-col bg-paper text-ink">
      <div
        className="flex items-center justify-between border-b-4 px-4 py-3"
        style={{ borderColor: teamColor(group.teamName) }}
      >
        <div>
          <p className="label-tech text-[10px] text-muted">선택된 그룹</p>
          <h1
            className="text-lg font-extrabold"
            style={{ color: teamColor(group.teamName) }}
          >
            {group.displayName}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/inventory"
            className="label-tech text-[10px] text-ink underline underline-offset-2"
          >
            인벤토리
          </Link>
          <form action={clearGroup}>
            <button
              type="submit"
              className="label-tech text-[10px] text-muted underline underline-offset-2"
            >
              다시 선택
            </button>
          </form>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <KakaoMap
          locations={locations}
          onSelectLocation={(id) => setSelectedId(id)}
        />

        {targetRegionName && (
          <div className="label-tech absolute top-3 left-1/2 z-50 -translate-x-1/2 rounded-full border-2 border-ink bg-paper px-3 py-1.5 text-[10px] whitespace-nowrap text-ink shadow-md">
            다음 목적지: {targetRegionName}지역
          </div>
        )}

        {selectedLocation && (
          <LocationPanel
            location={selectedLocation}
            isCurrentRegion={selectedLocation.regionId === targetRegionId}
            targetRegionName={targetRegionName}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </main>
  );
}
