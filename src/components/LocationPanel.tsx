"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { MapLocationInfo, PanelStep } from "@/components/MapScreen";
import { supabaseBrowser } from "@/lib/supabase-client";

const MISSION_LABEL: Record<string, string> = {
  WORD: "말씀",
  PRAISE: "찬양",
  PRAYER: "기도",
  PUZZLE: "퀴즈",
};

export type SubmitResult = {
  result: "wrong_region" | "closed" | "failed" | "passed" | string;
  message?: string;
  submissionId?: string;
  mission?: { type: string; content: string; imageUrl: string | null } | null;
  photoUrl?: string | null;
  videoUrl?: string | null;
  answerCorrect?: boolean;
};

function passCode(location: MapLocationInfo) {
  return `${location.regionName.toUpperCase()}-${location.id.slice(-4).toUpperCase()}`;
}

function ZoomableImage({
  src,
  alt,
  className,
  onZoom,
}: {
  src: string;
  alt: string;
  className: string;
  onZoom: (src: string) => void;
}) {
  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onClick={() => onZoom(src)}
        className={`cursor-pointer ${className}`}
      />
      <span className="pointer-events-none absolute right-1.5 bottom-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[9px] text-white">
        🔍 확대
      </span>
    </div>
  );
}

// "차례가 아님"/"마감" 등 진행을 막는 안내를 평범한 문단으로 두면 잘 안 읽혀서,
// PASS 카드와 같은 카드 골격(헤어라인 테두리 + 점선 헤더 구분선)을 그대로 써서
// 정보로서 눈에 띄게 하되, 오렌지 펄스 같은 축하용 모션은 쓰지 않는다 — 그건
// PASS 전용으로 아껴둬야 "통과했을 때"의 임팩트가 유지된다.
function HoldCard({
  headerLabel,
  headerRight,
  message,
}: {
  headerLabel: string;
  headerRight: string;
  message: string;
}) {
  return (
    <div className="animate-card-rise overflow-hidden rounded-lg border border-accent bg-paper-panel shadow-[0_10px_26px_-14px_rgba(20,18,12,0.35)]">
      <div className="flex items-center justify-between border-b border-dashed border-line px-3 py-2">
        <span className="text-sm font-extrabold tracking-wide text-accent">
          {headerLabel}
        </span>
        <span className="label-tech text-[10px] text-muted">
          {headerRight}
        </span>
      </div>
      <div className="p-3">
        <p className="text-sm leading-snug text-ink">{message}</p>
      </div>
    </div>
  );
}

function PassCard({
  location,
  mission,
  showPulse,
  onPulseEnd,
}: {
  location: MapLocationInfo;
  mission?: { type: string; content: string; imageUrl: string | null } | null;
  showPulse: boolean;
  onPulseEnd: () => void;
}) {
  return (
    <div className="relative">
      {showPulse && (
        <div
          onAnimationEnd={onPulseEnd}
          className="animate-pass-pulse pointer-events-none absolute -inset-6 rounded-2xl"
          style={{
            background:
              "radial-gradient(circle, rgba(225,89,28,0.4), transparent 70%)",
          }}
        />
      )}
      <div className="relative overflow-hidden rounded-lg border border-line bg-paper-panel shadow-[0_10px_26px_-14px_rgba(20,18,12,0.35)]">
        <div className="flex items-center justify-between border-b border-dashed border-line px-3 py-2">
          <span className="text-sm font-extrabold tracking-wide text-ink">
            PASS
          </span>
          <span className="label-tech text-[10px] text-muted">
            {passCode(location)}
          </span>
        </div>
        <div className="p-3">
          <p className="label-tech text-[10px] text-accent">
            {MISSION_LABEL[mission?.type ?? ""] ?? mission?.type} 미션
          </p>
          {mission?.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mission.imageUrl}
              alt=""
              className="mt-2 max-h-56 w-full rounded-md border border-line object-contain bg-paper"
            />
          )}
          <p className="mt-1 text-base leading-snug font-bold text-ink">
            {mission?.content || "자유곡으로 찬양해주세요."}
          </p>
        </div>
      </div>
    </div>
  );
}

export function LocationPanel({
  location,
  isCurrentRegion,
  targetRegionName,
  targetRegionAwaitingCompletion,
  onClose,
  result,
  onResult,
  step,
  onStepChange,
}: {
  location: MapLocationInfo;
  isCurrentRegion: boolean;
  targetRegionName: string | null;
  targetRegionAwaitingCompletion: boolean;
  onClose: () => void;
  result: SubmitResult | undefined;
  onResult: (result: SubmitResult | null) => void;
  step: PanelStep;
  onStepChange: (step: PanelStep) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [answerInput, setAnswerInput] = useState("");
  const [answerSubmitting, setAnswerSubmitting] = useState(false);
  const [answerWrong, setAnswerWrong] = useState(false);
  const [pulseShown, setPulseShown] = useState(false);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  const router = useRouter();
  const isPuzzle = result?.mission?.type === "PUZZLE";

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setPreviewUrl(selected ? URL.createObjectURL(selected) : null);
  }

  async function handleSubmit() {
    if (!file) return;
    setSubmitting(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";

      // 1. 서명된 업로드 URL 발급 (우리 서버는 사진 바이트를 거치지 않음 —
      // 폰 카메라 사진은 Vercel 서버리스 요청 크기 제한을 쉽게 넘을 수 있음)
      const urlRes = await fetch("/api/submissions/photo-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ext }),
      });
      const urlData = await urlRes.json();
      if (!urlData.ok) throw new Error(urlData.message || "업로드 URL 발급 실패");

      // 2. 브라우저 → Supabase Storage 직접 업로드
      const { error: uploadError } = await supabaseBrowser.storage
        .from(urlData.bucket)
        .uploadToSignedUrl(urlData.path, urlData.token, file);
      if (uploadError) throw uploadError;

      // 3. 캡 확인 + AI 판정 요청 — 사진은 이미 Storage에 있으니 경로만 전달
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: location.id, photoPath: urlData.path }),
      });
      if (!res.ok) throw new Error("요청 실패");
      const data: SubmitResult = await res.json();
      onResult(data);
      // 지역 진행 상태(다음 목적지, 같은 지역 다른 포인트 안내)는 서버에서 계산되므로
      // 새 판정 결과를 반영하도록 서버 컴포넌트 데이터를 다시 불러온다.
      router.refresh();
    } catch {
      onResult({
        result: "failed",
        message:
          "업로드 중 문제가 생겼어요 (네트워크 상태를 확인하고) 다시 시도해주세요.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function resetForRetry() {
    setFile(null);
    setPreviewUrl(null);
    onResult(null);
  }

  async function handleVideoUpload() {
    if (!videoFile || !result?.submissionId) return;
    setVideoUploading(true);
    try {
      const ext = videoFile.name.split(".").pop() || "mp4";

      // 1. 서명된 업로드 URL 발급 (우리 서버는 영상 바이트를 거치지 않음)
      const urlRes = await fetch(
        `/api/submissions/${result.submissionId}/video`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ext }),
        },
      );
      const urlData = await urlRes.json();
      if (!urlData.ok) throw new Error(urlData.message || "업로드 URL 발급 실패");

      // 2. 브라우저 → Supabase Storage 직접 업로드
      const { error: uploadError } = await supabaseBrowser.storage
        .from(urlData.bucket)
        .uploadToSignedUrl(urlData.path, urlData.token, videoFile);
      if (uploadError) throw uploadError;

      // 3. 업로드 완료를 서버에 알려 Submission.videoUrl 갱신
      const completeRes = await fetch(
        `/api/submissions/${result.submissionId}/video-complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: urlData.path }),
        },
      );
      const completeData = await completeRes.json();
      if (completeData.ok) {
        onResult({ ...result, videoUrl: completeData.videoUrl });
        // 영상 업로드가 끝나야 지역이 "완료"로 잡혀 다음 목적지로 넘어가므로,
        // 서버에서 계산되는 진행 상태를 다시 불러온다.
        router.refresh();
      }
    } catch (e) {
      console.error("영상 업로드 실패:", e);
    } finally {
      setVideoUploading(false);
    }
  }

  async function handleAnswerSubmit() {
    if (!answerInput.trim() || !result?.submissionId) return;
    setAnswerSubmitting(true);
    setAnswerWrong(false);
    try {
      const res = await fetch(
        `/api/submissions/${result.submissionId}/answer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answer: answerInput }),
        },
      );
      const data = await res.json();
      if (data.ok && data.correct) {
        onResult({ ...result, answerCorrect: true });
        // 정답 제출로 지역이 "완료"로 잡혀 다음 목적지로 넘어가므로, 서버에서
        // 계산되는 진행 상태를 다시 불러온다.
        router.refresh();
      } else {
        setAnswerWrong(true);
      }
    } catch (e) {
      console.error("정답 제출 실패:", e);
    } finally {
      setAnswerSubmitting(false);
    }
  }

  const passed = result?.result === "passed";
  // 통과 화면이나 실제 업로드 폼처럼 내용이 있는 상태만 패널을 넉넉하게 채움.
  // "이미 다른 포인트에서 통과함"/"차례 아님"/"마감" 같은 짧은 안내 문구만 있을
  // 때는 그 텍스트만큼만 차지하고 빈 여백을 억지로 만들지 않는다.
  const isRoomy =
    passed ||
    (!location.regionCompletedElsewhere &&
      isCurrentRegion &&
      !location.isClosed &&
      result?.result !== "closed" &&
      result?.result !== "wrong_region");

  return (
    <div
      className={`relative z-10 flex max-h-[60dvh] flex-col overflow-y-auto border-t border-line bg-paper-panel px-4 pt-4 pb-4 text-ink lg:h-full lg:max-h-none lg:w-[40%] lg:shrink-0 lg:border-t-0 lg:border-l ${isRoomy ? "min-h-[45dvh] lg:min-h-0" : ""}`}
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="label-tech text-[10px] text-muted">
            {location.regionName}지역
          </p>
          <h2 className="text-base font-bold">{location.name}</h2>
        </div>
        <button
          onClick={onClose}
          className="label-tech text-[10px] text-muted underline underline-offset-2"
        >
          닫기
        </button>
      </div>

      {location.teammateProgress && (
        <div className="mb-3 rounded-md border border-line bg-paper p-2">
          <p className="label-tech mb-1 text-[10px] text-accent">
            같은 팀 진행 상황
          </p>
          <p className="text-sm text-ink">
            {location.teammateProgress.groupDisplayName}가 이미{" "}
            {location.regionName}지역 &ldquo;{location.teammateProgress.locationName}
            &rdquo;에서 통과했어요.
          </p>
        </div>
      )}

      {!passed && location.regionCompletedElsewhere ? (
        <p className="text-sm text-ink">
          이미 {location.regionName}지역 &ldquo;{location.regionCompletedElsewhere.locationName}
          &rdquo;에서 통과했어요.{" "}
          {location.regionCompletedElsewhere.completed
            ? "미션은 그 포인트에서 확인하세요."
            : "그 포인트로 돌아가 미션을 마저 완료해주세요."}
        </p>
      ) : passed ? (
        <div className="space-y-3">
          <div className="flex gap-1 rounded-md border border-line p-1">
            <button
              onClick={() => onStepChange("pass")}
              className={`label-tech flex-1 rounded px-2 py-1.5 text-[10px] transition-colors ${
                step === "pass" ? "bg-ink text-paper" : "text-muted"
              }`}
            >
              통과 정보
            </button>
            <button
              onClick={() => onStepChange("video")}
              className={`label-tech flex-1 rounded px-2 py-1.5 text-[10px] transition-colors ${
                step === "video" ? "bg-ink text-paper" : "text-muted"
              }`}
            >
              {isPuzzle ? "정답 제출" : "영상 업로드"}
            </button>
          </div>

          {step === "pass" ? (
            <div className="space-y-3">
              <PassCard
                location={location}
                mission={result.mission}
                showPulse={!pulseShown}
                onPulseEnd={() => setPulseShown(true)}
              />
              {result.message && (
                <div className="rounded-md border border-line bg-paper p-2">
                  <p className="label-tech mb-1 text-[10px] text-muted">
                    AI 판정 코멘트
                  </p>
                  <p className="text-sm text-ink">{result.message}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="label-tech mb-1 text-[10px] text-muted">
                    기준 사진
                  </p>
                  {location.referencePhotoUrl ? (
                    <ZoomableImage
                      src={location.referencePhotoUrl}
                      alt="기준 사진"
                      onZoom={setZoomSrc}
                      className="h-44 w-full lg:h-72 rounded-md border border-line object-contain bg-paper"
                    />
                  ) : (
                    <div className="flex h-44 w-full lg:h-72 items-center justify-center rounded-md border border-dashed border-line bg-paper text-xs text-muted">
                      미등록
                    </div>
                  )}
                </div>
                <div>
                  <p className="label-tech mb-1 text-[10px] text-muted">
                    내가 제출한 사진
                  </p>
                  {result.photoUrl ? (
                    <ZoomableImage
                      src={result.photoUrl}
                      alt="내가 제출한 사진"
                      onZoom={setZoomSrc}
                      className="h-44 w-full lg:h-72 rounded-md border border-line object-contain bg-paper"
                    />
                  ) : (
                    <div className="flex h-44 w-full lg:h-72 items-center justify-center rounded-md border border-dashed border-line bg-paper text-xs text-muted">
                      기록 없음
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <PassCard
                location={location}
                mission={result.mission}
                showPulse={false}
                onPulseEnd={() => {}}
              />
              {isPuzzle ? (
                <>
                  <p className="label-tech text-[10px] text-muted">정답</p>
                  {result.answerCorrect ? (
                    <p className="rounded-md border border-line bg-paper p-2 text-sm font-medium text-ink">
                      정답이에요 — 미션 완료!
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {answerWrong && (
                        <p className="rounded-md border border-accent bg-paper-panel p-2 text-sm font-medium text-accent">
                          오답이에요. 다시 시도해보세요.
                        </p>
                      )}
                      <div className="flex gap-2">
                        <input
                          value={answerInput}
                          onChange={(e) => {
                            setAnswerInput(e.target.value);
                            setAnswerWrong(false);
                          }}
                          placeholder="정답 입력"
                          className="flex-1 rounded-md border border-line px-3 py-2 text-sm"
                        />
                        <button
                          onClick={handleAnswerSubmit}
                          disabled={!answerInput.trim() || answerSubmitting}
                          className="rounded-md bg-accent px-3 py-2 text-sm font-bold text-white shadow-[0_4px_12px_-4px_rgba(225,89,28,0.5)] disabled:opacity-40"
                        >
                          {answerSubmitting ? "확인 중..." : "제출"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="label-tech text-[10px] text-muted">
                    미션 수행 영상 (30초 이상)
                  </p>
                  {result.videoUrl ? (
                    <video
                      controls
                      src={result.videoUrl}
                      className="w-full rounded-md border border-line"
                    />
                  ) : (
                    <div className="flex gap-2">
                      <label className="flex-1 cursor-pointer rounded-md border border-line px-3 py-2 text-center text-sm font-medium">
                        {videoFile ? videoFile.name : "영상 선택"}
                        <input
                          type="file"
                          accept="video/*"
                          className="hidden"
                          onChange={(e) =>
                            setVideoFile(e.target.files?.[0] ?? null)
                          }
                        />
                      </label>
                      <button
                        onClick={handleVideoUpload}
                        disabled={!videoFile || videoUploading}
                        className="flex-1 rounded-md bg-accent px-3 py-2 text-sm font-bold text-white shadow-[0_4px_12px_-4px_rgba(225,89,28,0.5)] disabled:opacity-40"
                      >
                        {videoUploading ? "업로드 중..." : "영상 업로드"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      ) : !isCurrentRegion ? (
        targetRegionName && (
          <HoldCard
            headerLabel="LOCKED"
            headerRight={
              targetRegionAwaitingCompletion
                ? `${targetRegionName}지역 · 완료 대기`
                : `현재 · ${targetRegionName}지역`
            }
            message={
              targetRegionAwaitingCompletion
                ? `${targetRegionName}지역 미션 완료 필요`
                : `${targetRegionName}지역부터 먼저 완료`
            }
          />
        )
      ) : location.isClosed ? (
        <HoldCard
          headerLabel="CLOSED"
          headerRight={`${location.regionName}지역`}
          message="정원 마감 · 같은 지역의 다른 포인트 이용"
        />
      ) : result?.result === "closed" ? (
        <p className="text-sm text-ink">{result.message}</p>
      ) : result?.result === "wrong_region" ? (
        <p className="text-sm text-ink">{result.message}</p>
      ) : (
        <div className="space-y-3">
          {result?.result === "failed" && (
            <p className="rounded-md border border-accent bg-paper-panel p-2 text-sm font-medium text-accent">
              {result.message}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="label-tech mb-1 text-[10px] text-muted">
                기준 사진
              </p>
              {location.referencePhotoUrl ? (
                <ZoomableImage
                  src={location.referencePhotoUrl}
                  alt="기준 사진"
                  onZoom={setZoomSrc}
                  className="h-44 w-full lg:h-72 rounded-md border border-line object-contain bg-paper"
                />
              ) : (
                <div className="flex h-44 w-full lg:h-72 items-center justify-center rounded-md border border-dashed border-line bg-paper text-xs text-muted">
                  기준 사진 미등록 (더미 데이터)
                </div>
              )}
            </div>

            <div>
              <p className="label-tech mb-1 text-[10px] text-muted">
                내가 찍은 사진
              </p>
              {previewUrl || result?.photoUrl ? (
                <ZoomableImage
                  src={previewUrl ?? result!.photoUrl!}
                  alt="업로드할 사진"
                  onZoom={setZoomSrc}
                  className="h-44 w-full lg:h-72 rounded-md border border-line object-contain bg-paper"
                />
              ) : (
                <div className="flex h-44 w-full lg:h-72 items-center justify-center rounded-md border border-dashed border-line bg-paper text-xs text-muted">
                  아직 없음
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <label className="flex-1 cursor-pointer rounded-md border border-line bg-paper-panel px-3 py-2 text-center text-sm font-medium">
              {file ? "사진 다시 선택" : "사진 선택"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
            <button
              onClick={handleSubmit}
              disabled={!file || submitting}
              className="flex-1 rounded-md bg-accent px-3 py-2 text-sm font-bold text-white shadow-[0_4px_12px_-4px_rgba(225,89,28,0.5)] disabled:opacity-40"
            >
              {submitting ? "판정 중..." : "제출하기"}
            </button>
          </div>

          {result?.result === "failed" && (
            <button
              onClick={resetForRetry}
              className="text-xs text-muted underline underline-offset-2"
            >
              처음부터 다시
            </button>
          )}
        </div>
      )}

      {zoomSrc &&
        createPortal(
          // 패널 자체가 overflow-y-auto 스크롤 컨테이너라, 그 안에 fixed 오버레이를
          // 두면 실기기 사파리에서 화면 전체가 아니라 그 스크롤 영역 안에서만
          // "고정"되는 문제가 있었다 — body로 포탈을 띄워서 완전히 분리한다.
          <div
            onClick={() => setZoomSrc(null)}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={zoomSrc}
              alt="확대된 사진"
              className="max-h-full max-w-full object-contain"
            />
            {/* 우상단은 실기기에서 노치/브라우저 상단 UI에 가려 안 보이는 경우가
                있어 하단 중앙으로 옮김 — 어차피 사진/배경 아무 곳이나 탭해도 닫힌다. */}
            <button
              onClick={() => setZoomSrc(null)}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-sm font-bold text-ink shadow"
            >
              닫기
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
