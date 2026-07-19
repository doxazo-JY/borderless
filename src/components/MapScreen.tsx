"use client";

import { useState } from "react";
import Link from "next/link";
import { KakaoMap } from "@/components/KakaoMap";
import { LocationPanel, type SubmitResult } from "@/components/LocationPanel";
import { clearGroup } from "@/app/actions";
import { teamColor } from "@/lib/team-colors";
import type { RegionProgressItem } from "@/lib/region-progress";

export type MapLocationInfo = {
  id: string;
  name: string;
  regionId: string;
  regionName: string;
  lat: number;
  lng: number;
  referencePhotoUrl: string | null;
  isClosed: boolean;
  passedInfo: {
    submissionId: string;
    mission: { type: string; content: string } | null;
    photoUrl: string | null;
    videoUrl: string | null;
    aiReason: string | null;
  } | null;
  regionCompletedElsewhere: {
    locationName: string;
    videoUploaded: boolean;
  } | null;
  lastFailedMessage: string | null;
};

export type PanelStep = "pass" | "video";

function regionInitialResult(
  location: MapLocationInfo,
): SubmitResult | undefined {
  if (location.passedInfo) {
    return {
      result: "passed",
      submissionId: location.passedInfo.submissionId,
      mission: location.passedInfo.mission,
      photoUrl: location.passedInfo.photoUrl,
      videoUrl: location.passedInfo.videoUrl,
      message: location.passedInfo.aiReason ?? undefined,
    };
  }
  // 실패 사유는 통과와 달리 서버 state가 따로 없었어서 새로고침하면 사라졌다 —
  // 아직 통과 못 한 위치에 마지막 실패 사유가 있으면 그것도 초기값으로 채워준다.
  if (location.lastFailedMessage) {
    return { result: "failed", message: location.lastFailedMessage };
  }
  return undefined;
}

export function MapScreen({
  group,
  locations,
  regionProgress,
  targetRegionId,
  targetRegionName,
  groupSelectionLocked,
}: {
  group: { id: string; displayName: string; teamName: string };
  locations: MapLocationInfo[];
  regionProgress: RegionProgressItem[];
  targetRegionId: string | null;
  targetRegionName: string | null;
  groupSelectionLocked: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 그룹이 위치 패널을 닫고 지도만 보다가 다시 열어도(마커 재클릭) 통과 상태/영상 업로드
  // 여부가 사라지지 않도록, 결과와 현재 탭을 MapScreen 레벨에서 위치별로 들고 있는다.
  const [results, setResults] = useState<Record<string, SubmitResult>>(() => {
    const initial: Record<string, SubmitResult> = {};
    for (const loc of locations) {
      const r = regionInitialResult(loc);
      if (r) initial[loc.id] = r;
    }
    return initial;
  });
  const [steps, setSteps] = useState<Record<string, PanelStep>>({});

  const selectedLocation = locations.find((l) => l.id === selectedId) ?? null;
  const currentIndex = regionProgress.findIndex((p) => p.status === "current");
  const stepperPct =
    regionProgress.length > 0
      ? ((currentIndex >= 0 ? currentIndex : regionProgress.length - 1) + 0.5) /
        regionProgress.length
      : 0.5;
  // 이미 이 지역에서 AI 판정은 통과하고 영상 업로드만 남은 상태면 "다음 목적지"라는
  // 말이 어색하므로("이미 여기 있는데 다음 목적지가 여기?"), 문구를 다르게 보여준다.
  const targetRegionAwaitingVideo = locations.some(
    (l) => l.regionId === targetRegionId && l.passedInfo && !l.passedInfo.videoUrl,
  );

  return (
    <main className="flex flex-1 flex-col bg-paper text-ink">
      <div className="relative border-b border-line px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="label-tech text-[10px] text-muted">선택된 그룹</p>
            <h1
              className="text-lg font-bold"
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
            {!groupSelectionLocked && (
              <form action={clearGroup}>
                <button
                  type="submit"
                  className="label-tech text-[10px] text-muted underline underline-offset-2"
                >
                  다시 선택
                </button>
              </form>
            )}
          </div>
        </div>

        {regionProgress.length > 0 && (
          <div className="mt-2">
            <div className="flex gap-[3px]">
              {regionProgress.map((p) => (
                <span
                  key={p.regionId}
                  className={`h-[3px] flex-1 rounded-full ${
                    p.status === "done"
                      ? "bg-muted"
                      : p.status === "current"
                        ? "bg-accent"
                        : "bg-line"
                  }`}
                />
              ))}
            </div>
            <div className="mt-1 flex gap-[3px]">
              {regionProgress.map((p) => (
                <span
                  key={p.regionId}
                  className={`label-tech flex-1 text-center text-[9px] ${
                    p.status === "current"
                      ? "font-bold text-accent"
                      : "text-muted"
                  }`}
                >
                  {p.regionName}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 현재 위치 점 — 아래 지도 프레임의 목적지 배지로 연결선이 이어짐 */}
        <span
          className="absolute bottom-[-4px] h-[7px] w-[7px] -translate-x-1/2 translate-y-1/2 rounded-full bg-accent"
          style={{
            left: `${stepperPct * 100}%`,
            boxShadow: "0 0 0 3px var(--color-paper)",
          }}
        />
      </div>

      <div className="relative min-h-0 flex-1 p-2">
        <div className="flex h-full flex-col overflow-hidden rounded-lg border border-line bg-paper-panel shadow-[0_2px_6px_rgba(20,18,12,0.05)]">
          <div className="relative min-h-0 flex-1">
            <KakaoMap
              locations={locations.map((loc) => {
                const passed = results[loc.id]?.result === "passed";
                return {
                  ...loc,
                  isPassed: passed,
                  isVideoDone: passed && !!results[loc.id]?.videoUrl,
                  isClosed: loc.isClosed,
                };
              })}
              onSelectLocation={(id) => setSelectedId(id)}
            />
          </div>

          {selectedLocation && (
            <LocationPanel
              // 마커를 닫지 않고 바로 다른 위치로 옮겨 클릭하면 selectedId만 바뀌고
              // 컴포넌트는 재사용돼서, 이전 위치에서 골라둔 사진/영상 파일 같은 내부
              // state(useState)가 그대로 남아있는 문제가 있었다 — key로 위치가 바뀔
              // 때마다 완전히 새로 마운트되게 강제한다.
              key={selectedLocation.id}
              location={selectedLocation}
              isCurrentRegion={selectedLocation.regionId === targetRegionId}
              targetRegionName={targetRegionName}
              targetRegionAwaitingVideo={targetRegionAwaitingVideo}
              onClose={() => setSelectedId(null)}
              result={results[selectedLocation.id]}
              onResult={(r) =>
                setResults((prev) => {
                  if (r === null) {
                    const next = { ...prev };
                    delete next[selectedLocation.id];
                    return next;
                  }
                  return { ...prev, [selectedLocation.id]: r };
                })
              }
              step={steps[selectedLocation.id] ?? "pass"}
              onStepChange={(step) =>
                setSteps((prev) => ({ ...prev, [selectedLocation.id]: step }))
              }
            />
          )}
        </div>

        {/* 연결선: 헤더의 현재 위치 점에서 아래로 이어져 목적지 배지에 닿는다 */}
        <span
          className="pointer-events-none absolute top-0 h-[14px] w-[1.5px] -translate-x-1/2 bg-accent"
          style={{ left: `${stepperPct * 100}%` }}
        />

        {targetRegionName && (
          <div
            className="label-tech absolute top-2 z-40 -translate-x-1/2 rounded-md border border-line bg-white/90 px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap text-ink shadow-[0_3px_10px_rgba(20,18,12,0.12)]"
            style={{ left: `${stepperPct * 100}%` }}
          >
            {targetRegionAwaitingVideo
              ? `${targetRegionName}지역 · 영상 업로드 남음`
              : `다음 목적지 · ${targetRegionName}지역`}
          </div>
        )}
      </div>
    </main>
  );
}
