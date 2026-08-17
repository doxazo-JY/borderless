"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NaverMap } from "@/components/NaverMap";
import { HelpButton } from "@/components/HelpButton";
import { LocationPanel, type SubmitResult } from "@/components/LocationPanel";
import { PensionPanel } from "@/components/PensionPanel";
import { ConversationTopicPanel } from "@/components/ConversationTopicPanel";
import { ParchmentBurn } from "@/components/ParchmentBurn";
import { ParchmentStains } from "@/components/ParchmentStains";
import { clearGroup } from "@/app/actions";
import { teamColor } from "@/lib/team-colors";
import type { RegionProgressItem } from "@/lib/region-progress";

export type MapLocationInfo = {
  id: string;
  name: string;
  regionId: string;
  regionName: string;
  // 실제 4지역 방문 순서와 무관하게 항상 열려있어야 하는 데모용 예시 포인트인지.
  // true면 targetRegionId 비교(방문 순서 강제)를 건너뛴다.
  regionIsExample: boolean;
  lat: number;
  lng: number;
  referencePhotoUrl: string | null;
  isClosed: boolean;
  passedInfo: {
    submissionId: string;
    mission: { type: string; content: string; imageUrl: string | null } | null;
    photoUrl: string | null;
    videoUrl: string | null;
    aiReason: string | null;
  } | null;
  regionCompletedElsewhere: {
    locationName: string;
    completed: boolean;
  } | null;
  lastFailedInfo: { message: string; photoUrl: string | null } | null;
  // 같은 팀 다른 조가 이 지역을 이미 통과했으면 채워짐 — 팀 밖으로는 안 보임(서버에서
  // teamId로 이미 필터링됨), 이 그룹 자신의 진행/제출 가능 여부에는 영향 없는 안내용.
  teammateProgress: { groupDisplayName: string; locationName: string } | null;
};

export type PanelStep = "pass" | "video";

function isMissionDone(passedInfo: NonNullable<MapLocationInfo["passedInfo"]>) {
  return !!passedInfo.videoUrl;
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
  aiJudgingDisabled,
  announcementText,
  earnedIngredients,
  teammatesRegionProgress,
}: {
  group: { id: string; displayName: string; teamName: string };
  locations: MapLocationInfo[];
  regionProgress: RegionProgressItem[];
  targetRegionId: string | null;
  targetRegionName: string | null;
  groupSelectionLocked: boolean;
  aiJudgingDisabled: boolean;
  announcementText: string | null;
  earnedIngredients: { id: string; name: string }[];
  teammatesRegionProgress: {
    groupId: string;
    displayName: string;
    progress: RegionProgressItem[];
  }[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showPension, setShowPension] = useState(false);
  const [showTopics, setShowTopics] = useState(false);
  // 배너(AI 판정 중단/숙소 복귀 안내)는 지도를 밀어내리지 않고 지도 위에 뜨는
  // 오버레이라, 사용자가 접어서 지도를 더 크게 볼 수 있게 한다. 그룹명/스테퍼
  // 헤더는 작아서 접을 필요 없이 항상 문서 흐름 그대로 둔다.
  const [showBannerOverlay, setShowBannerOverlay] = useState(true);
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
  const router = useRouter();

  // 위 useState는 마운트 시점 props로 딱 한 번만 초기화되기 때문에, 그 이후
  // router.refresh()로 서버가 새 passedInfo(예: 임원이 수동 통과 처리)를 내려줘도
  // 이 로컬 state에는 절대 반영이 안 됐다 — 폴링 주기를 아무리 줄여도 화면이 안
  // 바뀌던 진짜 원인이 이거였다. locations prop이 (router.refresh로) 바뀔 때마다
  // 서버가 내려준 최신 값으로 다시 덮어써서 항상 동기화되게 한다.
  // useEffect 안에서 setState를 하면 렌더가 한 번 더 튀는 문제가 있어서(React 권장
  // 안티패턴), 대신 렌더 도중에 이전 locations와 비교해서 바뀌었을 때만 즉시
  // setState하는 "렌더 중 state 조정" 패턴을 쓴다.
  const [prevLocations, setPrevLocations] = useState(locations);
  if (locations !== prevLocations) {
    setPrevLocations(locations);
    setResults((prev) => {
      const next = { ...prev };
      for (const loc of locations) {
        const r = regionInitialResult(loc);
        if (r) next[loc.id] = r;
      }
      return next;
    });
  }

  // 서버가 내려주는 정보(AI 판정 중단 배너, 같은 팀 다른 조 현황, 마감 여부 등)가
  // 참가자가 직접 새로고침하지 않아도 주기적으로 갱신되도록 폴링한다. 이 화면
  // 자체는 서버 컴포넌트가 매번 다시 계산해 내려주므로, 여기서 할 일은 그 다시
  // 불러오기를 주기적으로 트리거하는 것뿐이다 — 패널을 열어둔 상태나 입력 중인
  // 폼(사진/영상 선택 등)의 로컬 state는 이 컴포넌트가 리마운트되는 게 아니라서
  // 그대로 유지된다.
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 4000);
    return () => clearInterval(interval);
  }, [router]);

  // 4지역 모두 미션 완료(영상 업로드까지)면 상단에 숙소 복귀 안내를 계속 띄운다.
  const allRegionsDone =
    regionProgress.length > 0 && regionProgress.every((p) => p.status === "done");
  const showTopBanner = aiJudgingDisabled || allRegionsDone || !!announcementText;

  // 전역 "도움 요청" 버튼(HelpButton)은 루트 레이아웃에 fixed로 떠 있어 헤더/배너의
  // 유무·높이를 모른다 — 두 요소 높이를 더하고 바깥 padding(p-5/p-2 등)을 따로
  // 어림잡아 더하면 패딩 값이 바뀔 때마다 다시 안 맞을 수 있어서, 대신
  // getBoundingClientRect()로 "배너(있으면)나 헤더의 실제 뷰포트 기준 하단 좌표"를
  // 직접 읽는다 — 어떤 padding/border가 껴 있든 항상 정확하다.
  const headerRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function updateOffset() {
      const lowestEl =
        (showTopBanner && showBannerOverlay ? bannerRef.current : null) ??
        headerRef.current;
      const bottom = lowestEl?.getBoundingClientRect().bottom ?? 0;
      document.documentElement.style.setProperty(
        "--help-button-top",
        `${bottom + 8}px`,
      );
    }
    updateOffset();
    const observer = new ResizeObserver(updateOffset);
    if (headerRef.current) observer.observe(headerRef.current);
    if (bannerRef.current) observer.observe(bannerRef.current);
    window.addEventListener("resize", updateOffset);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateOffset);
      document.documentElement.style.removeProperty("--help-button-top");
    };
  }, [showTopBanner, showBannerOverlay]);

  // 전역 "도움 요청" 버튼(HelpButton)이 지금 보고 있는 포인트를 알아야 임원이
  // "통과 처리"할 수 있는(=locationId가 있는) 요청이 만들어진다. HelpButton은
  // 루트 레이아웃에 있어 이 컴포넌트의 state를 props로 못 받으니, body에
  // 데이터 속성으로 흘려보내고 요청 전송 시점에 거기서 읽어가게 한다.
  useEffect(() => {
    document.body.dataset.currentLocationId = selectedId ?? "";
    return () => {
      delete document.body.dataset.currentLocationId;
    };
  }, [selectedId]);

  const selectedLocation = locations.find((l) => l.id === selectedId) ?? null;
  // 이미 이 지역에서 AI 판정은 통과하고 완료(영상 업로드/정답 제출)만 남은 상태면
  // "다음 목적지"라는 말이 어색하므로("이미 여기 있는데 다음 목적지가 여기?"),
  // 문구를 다르게 보여준다.
  const targetRegionAwaitingCompletion = locations.some(
    (l) => l.regionId === targetRegionId && l.passedInfo && !isMissionDone(l.passedInfo),
  );

  return (
    <main className="route-map relative flex flex-1 flex-col overflow-hidden text-ink">
      <ParchmentStains />
      <ParchmentBurn outerWidth={14} innerWidth={9} insetPercent={0.25} />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col p-5">
      {/* 그룹명·스테퍼 헤더 — 작아서 접을 필요 없이 항상 문서 흐름 그대로 둔다.
          배너(AI 판정 중단/숙소 복귀)는 이 아래 지도 영역 안에서 지도 위에 뜬다. */}
      <div ref={headerRef} className="relative border-b border-line px-4 py-1.5">
        <div className="flex items-center justify-between">
          <div>
            <p className="label-tech text-[9px] text-muted">선택된 그룹</p>
            <h1
              className="text-base leading-tight font-bold"
              style={{ color: teamColor(group.teamName) }}
            >
              {group.displayName}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSelectedId(null);
                setShowPension(false);
                setShowTopics(true);
              }}
              className="panel-link label-tech text-[10px] text-ink"
            >
              질문 카드
            </button>
            {!groupSelectionLocked && (
              // form이 block 요소라 flex 정렬에서 버튼 높이가 미묘하게 어긋나던 것 —
              // display:contents로 form 자체를 레이아웃에서 지우고 버튼이 바로
              // 옆 버튼과 같은 flex item이 되게 한다.
              <form action={clearGroup} className="contents">
                <button
                  type="submit"
                  className="panel-link label-tech text-[10px] text-muted"
                >
                  팀 다시 선택
                </button>
              </form>
            )}
          </div>
        </div>

        {regionProgress.length > 0 && (
          <div className="mt-1">
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
            <div className="mt-0.5 flex gap-[3px]">
              {regionProgress.map((p) => (
                <span
                  key={p.regionId}
                  className={`label-tech flex-1 text-center text-[9px] leading-tight ${
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

      </div>

      <div className="relative min-h-0 flex-1 p-2">
        <div className="flex h-full flex-col overflow-hidden rounded-lg border border-line bg-paper-panel shadow-[0_2px_6px_rgba(20,18,12,0.05)] lg:flex-row">
          <div className="relative min-h-0 flex-1">
            <NaverMap
              locations={locations.map((loc) => {
                const passed = results[loc.id]?.result === "passed";
                const r = results[loc.id];
                // 본인이 통과한 포인트이거나, 아직 아무도 통과 안 한 "지금 차례" 지역의
                // 포인트만 실제로 의미 있다 — 나머지(차례 아닌 지역, 이미 다른 포인트로
                // 채워진 지역의 남은 포인트)는 흐리게 표시해서 눈에 덜 띄게 한다.
                const isRelevant =
                  passed ||
                  loc.regionIsExample ||
                  (!loc.regionCompletedElsewhere &&
                    loc.regionId === targetRegionId);
                return {
                  ...loc,
                  isPassed: passed,
                  isMissionDone: passed && !!r?.videoUrl,
                  isClosed: loc.isClosed,
                  isRelevant,
                };
              })}
              onSelectLocation={(id) => {
                setShowPension(false);
                setShowTopics(false);
                setSelectedId(id);
              }}
              selectedLocationId={selectedId}
              onSelectPension={() => {
                setSelectedId(null);
                setShowTopics(false);
                setShowPension(true);
              }}
              selectedPension={showPension}
              targetRegionId={targetRegionId}
            />

            {/* 배너(AI 판정 중단/숙소 복귀 안내)는 문서 흐름을 밀어내리지 않고
                지도 위에 뜬다 — 접으면 지도가 그만큼 넓게 보인다. */}
            {showTopBanner && showBannerOverlay && (
              <div
                ref={bannerRef}
                className="absolute inset-x-0 top-0 z-20 shadow-[0_8px_16px_-10px_rgba(20,18,12,0.5)]"
              >
                {announcementText && (
                  <div className="label-tech border-b border-red-700 bg-red-600 px-4 py-2 text-center text-[11px] font-bold text-white">
                    {announcementText}
                  </div>
                )}
                {aiJudgingDisabled && (
                  <div className="label-tech border-b border-accent bg-accent px-4 py-2 text-center text-[11px] font-bold text-white">
                    현재 AI 평가가 불가능해 임원의 수동 평가가 진행될 예정입니다. 사진 제출
                    후 &ldquo;임원 도움 요청&rdquo; 버튼을 눌러주세요.
                  </div>
                )}
                {allRegionsDone && (
                  <div className="label-tech border-b border-ink bg-ink px-4 py-2 text-center text-[11px] font-bold text-white">
                    모든 지역 미션 완료! 숙소로 돌아가세요.
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowBannerOverlay(false)}
                  className="label-tech absolute top-1 right-1 rounded-full bg-black/30 px-1.5 py-0.5 text-[9px] font-bold text-white"
                >
                  ✕
                </button>
              </div>
            )}

            {/* 배너를 접었을 때만 나타나는 재진입 탭 — 화면 중앙은 전역 SOS
                버튼(HelpButton, fixed)이 항상 차지하고 있어서 겹치지 않게
                왼쪽에 둔다. top이 -1px인 이유: SOS 버튼은 fixed로 헤더 바로
                아래(header.bottom + 8px)에 뜨는데, 이 탭은 지도 wrapper 기준
                absolute라 wrapper 자체가 이미 그보다 9px(콘텐츠 영역 padding
                8px + 프레임 border 1px) 아래에서 시작한다 — 그 차이를 상쇄해야
                두 버튼 높이가 맞는다. */}
            {showTopBanner && !showBannerOverlay && (
              <button
                type="button"
                onClick={() => setShowBannerOverlay(true)}
                className="panel-link label-tech absolute top-[-1px] left-2 z-20 text-[10px] font-bold text-ink"
              >
                ▾ 안내 보기
              </button>
            )}
          </div>

          {showPension ? (
            <PensionPanel
              onClose={() => setShowPension(false)}
              regionProgress={regionProgress}
              earnedIngredients={earnedIngredients}
              teammatesRegionProgress={teammatesRegionProgress}
            />
          ) : showTopics ? (
            <ConversationTopicPanel onClose={() => setShowTopics(false)} />
          ) : selectedLocation ? (
            <LocationPanel
              // 마커를 닫지 않고 바로 다른 위치로 옮겨 클릭하면 selectedId만 바뀌고
              // 컴포넌트는 재사용돼서, 이전 위치에서 골라둔 사진/영상 파일 같은 내부
              // state(useState)가 그대로 남아있는 문제가 있었다 — key로 위치가 바뀔
              // 때마다 완전히 새로 마운트되게 강제한다.
              key={selectedLocation.id}
              location={selectedLocation}
              isCurrentRegion={
                selectedLocation.regionIsExample ||
                selectedLocation.regionId === targetRegionId
              }
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
            <div className="parchment-panel relative hidden shrink-0 flex-col items-center justify-center border-l border-line px-6 text-center text-sm text-muted lg:flex lg:h-full lg:w-[40%]">
              <ParchmentStains idPrefix="empty-panel-stain" intensity={0.4} />
              지도에서 포인트를 선택하면
              <br />
              여기에 상세 정보가 표시돼요.
            </div>
          )}
        </div>
      </div>
      </div>
      <HelpButton />
    </main>
  );
}
