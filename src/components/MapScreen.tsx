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
    mission: { type: string; content: string; imageUrl: string | null } | null;
    photoUrl: string | null;
    videoUrl: string | null;
    answerCorrect: boolean;
    aiReason: string | null;
  } | null;
  regionCompletedElsewhere: {
    locationName: string;
    completed: boolean;
  } | null;
  lastFailedInfo: { message: string; photoUrl: string | null } | null;
};

export type PanelStep = "pass" | "video";

// PUZZLE 미션은 영상 업로드가 없으니 정답 제출 여부로 완료를 판단한다.
function isMissionDone(passedInfo: NonNullable<MapLocationInfo["passedInfo"]>) {
  return passedInfo.mission?.type === "PUZZLE"
    ? passedInfo.answerCorrect
    : !!passedInfo.videoUrl;
}

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
      answerCorrect: location.passedInfo.answerCorrect,
      message: location.passedInfo.aiReason ?? undefined,
    };
  }
  // 실패 사유(+제출했던 사진)는 통과와 달리 서버 state가 따로 없었어서 새로고침하면
  // 사라졌다 — 아직 통과 못 한 위치에 마지막 실패 기록이 있으면 그것도 채워준다.
  if (location.lastFailedInfo) {
    return {
      result: "failed",
      message: location.lastFailedInfo.message,
      photoUrl: location.lastFailedInfo.photoUrl,
    };
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
  // 이미 이 지역에서 AI 판정은 통과하고 완료(영상 업로드/정답 제출)만 남은 상태면
  // "다음 목적지"라는 말이 어색하므로("이미 여기 있는데 다음 목적지가 여기?"),
  // 문구를 다르게 보여준다.
  const targetRegionAwaitingCompletion = locations.some(
    (l) => l.regionId === targetRegionId && l.passedInfo && !isMissionDone(l.passedInfo),
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
        <div className="flex h-full flex-col overflow-hidden rounded-lg border border-line bg-paper-panel shadow-[0_2px_6px_rgba(20,18,12,0.05)] lg:flex-row">
          <div className="relative min-h-0 flex-1">
            <KakaoMap
              locations={locations.map((loc) => {
                const passed = results[loc.id]?.result === "passed";
                const r = results[loc.id];
                // 본인이 통과한 포인트이거나, 아직 아무도 통과 안 한 "지금 차례" 지역의
                // 포인트만 실제로 의미 있다 — 나머지(차례 아닌 지역, 이미 다른 포인트로
                // 채워진 지역의 남은 포인트)는 흐리게 표시해서 눈에 덜 띄게 한다.
                const isRelevant =
                  passed ||
                  (!loc.regionCompletedElsewhere &&
                    loc.regionId === targetRegionId);
                return {
                  ...loc,
                  isPassed: passed,
                  isMissionDone:
                    passed &&
                    (r?.mission?.type === "PUZZLE"
                      ? !!r?.answerCorrect
                      : !!r?.videoUrl),
                  isClosed: loc.isClosed,
                  isRelevant,
                };
              })}
              onSelectLocation={(id) => setSelectedId(id)}
              selectedLocationId={selectedId}
            />
          </div>

          {selectedLocation ? (
            <LocationPanel
              // 마커를 닫지 않고 바로 다른 위치로 옮겨 클릭하면 selectedId만 바뀌고
              // 컴포넌트는 재사용돼서, 이전 위치에서 골라둔 사진/영상 파일 같은 내부
              // state(useState)가 그대로 남아있는 문제가 있었다 — key로 위치가 바뀔
              // 때마다 완전히 새로 마운트되게 강제한다.
              key={selectedLocation.id}
              location={selectedLocation}
              isCurrentRegion={selectedLocation.regionId === targetRegionId}
              targetRegionName={targetRegionName}
              targetRegionAwaitingCompletion={targetRegionAwaitingCompletion}
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
          ) : (
            // 모바일에서는 선택 전엔 지도만 꽉 채우고(기존 동작 유지), PC 화면에서만
            // 우측에 빈 패널을 미리 보여줘서 "지도 왼쪽 · 패널 오른쪽" 2단 구성이
            // 마커를 클릭하기 전부터 자리 잡혀 보이게 한다.
            <div className="hidden shrink-0 flex-col items-center justify-center border-l border-line bg-paper-panel px-6 text-center text-sm text-muted lg:flex lg:h-full lg:w-[40%]">
              지도에서 포인트를 선택하면
              <br />
              여기에 상세 정보가 표시돼요.
            </div>
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
            {targetRegionAwaitingCompletion
              ? `${targetRegionName}지역 · 미션 완료 남음`
              : `현재 목적지 · ${targetRegionName}지역`}
          </div>
        )}
      </div>
    </main>
  );
}
