"use client";

import { useState } from "react";
import { KakaoMap } from "@/components/KakaoMap";
import { LocationPanel } from "@/components/LocationPanel";
import { clearGroup } from "@/app/actions";

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
  group: { id: string; displayName: string };
  locations: MapLocationInfo[];
  targetRegionId: string | null;
  targetRegionName: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedLocation = locations.find((l) => l.id === selectedId) ?? null;

  return (
    <main className="flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <div>
          <p className="text-xs text-zinc-500">선택된 그룹</p>
          <h1 className="text-lg font-bold">{group.displayName}</h1>
        </div>
        <form action={clearGroup}>
          <button
            type="submit"
            className="text-xs text-zinc-500 underline underline-offset-2"
          >
            다시 선택
          </button>
        </form>
      </div>

      <div className="relative min-h-0 flex-1">
        <KakaoMap
          locations={locations}
          onSelectLocation={(id) => setSelectedId(id)}
        />

        {targetRegionName && (
          <div className="absolute top-3 left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-xs whitespace-nowrap text-white">
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
