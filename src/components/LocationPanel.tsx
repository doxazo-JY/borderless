"use client";

import { useState } from "react";
import type { MapLocationInfo } from "@/components/MapScreen";
import { supabaseBrowser } from "@/lib/supabase-client";

const MISSION_LABEL: Record<string, string> = {
  WORD: "말씀",
  PRAISE: "찬양",
  PRAYER: "기도",
};

type SubmitResult = {
  result: "wrong_region" | "closed" | "failed" | "passed" | string;
  message?: string;
  submissionId?: string;
  mission?: { type: string; content: string } | null;
};

function StampReveal({ code }: { code: string }) {
  return (
    <svg viewBox="0 0 160 160" width="128" height="128" className="mx-auto">
      <defs>
        <path id="stampcircle" d="M 80 20 A 60 60 0 1 1 79.9 20" />
      </defs>
      <circle
        cx="80"
        cy="80"
        r="60"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="3"
      />
      <circle
        cx="80"
        cy="80"
        r="47"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="1"
      />
      <text fontSize="10" letterSpacing="3" fill="var(--color-accent)">
        <textPath href="#stampcircle" startOffset="2">
          FIELD CONTROL • FIELD CONTROL •
        </textPath>
      </text>
      <text
        x="80"
        y="86"
        textAnchor="middle"
        fontSize="22"
        fontWeight="800"
        fill="var(--color-ink)"
      >
        PASS
      </text>
      <text
        x="80"
        y="104"
        textAnchor="middle"
        fontSize="9"
        letterSpacing="2"
        fill="var(--color-muted)"
      >
        {code}
      </text>
    </svg>
  );
}

export function LocationPanel({
  location,
  isCurrentRegion,
  targetRegionName,
  onClose,
}: {
  location: MapLocationInfo;
  isCurrentRegion: boolean;
  targetRegionName: string | null;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploaded, setVideoUploaded] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setResult(null);
    setPreviewUrl(selected ? URL.createObjectURL(selected) : null);
  }

  async function handleSubmit() {
    if (!file) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("locationId", location.id);
      formData.append("photo", file);

      const res = await fetch("/api/submissions", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("요청 실패");
      const data: SubmitResult = await res.json();
      setResult(data);
    } catch {
      setResult({
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
    setResult(null);
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
        setVideoUploaded(true);
      }
    } catch (e) {
      console.error("영상 업로드 실패:", e);
    } finally {
      setVideoUploading(false);
    }
  }

  // 사진 업로드 UI/미션 공개처럼 내용이 있는 상태만 패널을 넉넉하게 채움.
  // "차례 아님"/"마감"처럼 짧은 안내 문구만 있을 때는 내용만큼만 차지.
  const isRoomy = isCurrentRegion && !location.isClosed;

  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-50 flex max-h-[55%] flex-col overflow-y-auto rounded-t-2xl border-t-4 border-ink bg-paper p-4 text-ink shadow-[0_-4px_16px_rgba(0,0,0,0.2)] ${isRoomy ? "min-h-[45%]" : ""}`}
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

      {!isCurrentRegion ? (
        <p className="text-sm text-ink">
          아직 이 지역으로 갈 차례가 아니에요.
          {targetRegionName && ` 다음 목적지는 ${targetRegionName}지역입니다.`}
        </p>
      ) : location.isClosed ? (
        <p className="text-sm text-ink">
          이미 마감된 포인트예요. 같은 지역의 다른 포인트로 가보세요.
        </p>
      ) : result?.result === "passed" ? (
        <div className="space-y-3">
          <StampReveal code={location.regionName.toUpperCase()} />
          {result.mission && (
            <div className="rounded-lg border-2 border-line bg-paper-panel p-3 text-center">
              <p className="label-tech text-[10px] text-accent">
                {MISSION_LABEL[result.mission.type] ?? result.mission.type} 미션
              </p>
              <p className="mt-2 text-lg leading-snug font-bold text-ink">
                {result.mission.content || "자유곡으로 찬양해주세요."}
              </p>
            </div>
          )}

          <div className="border-t border-line pt-3">
            <p className="label-tech mb-1 text-[10px] text-muted">
              미션 수행 영상 (10~20초)
            </p>
            {videoUploaded ? (
              <p className="text-sm font-semibold text-accent">
                영상 업로드 완료!
              </p>
            ) : (
              <div className="flex gap-2">
                <label className="flex-1 cursor-pointer rounded-lg border-2 border-line px-3 py-2 text-center text-sm font-medium">
                  {videoFile ? videoFile.name : "영상 촬영"}
                  <input
                    type="file"
                    accept="video/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) =>
                      setVideoFile(e.target.files?.[0] ?? null)
                    }
                  />
                </label>
                <button
                  onClick={handleVideoUpload}
                  disabled={!videoFile || videoUploading}
                  className="flex-1 rounded-lg bg-ink px-3 py-2 text-sm font-bold text-paper disabled:opacity-40"
                >
                  {videoUploading ? "업로드 중..." : "영상 업로드"}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : result?.result === "closed" ? (
        <p className="text-sm text-ink">{result.message}</p>
      ) : result?.result === "wrong_region" ? (
        <p className="text-sm text-ink">{result.message}</p>
      ) : (
        <div className="space-y-3">
          {result?.result === "failed" && (
            <p className="rounded-lg border-2 border-accent bg-paper-panel p-2 text-sm font-medium text-accent">
              {result.message}
            </p>
          )}

          <div>
            <p className="label-tech mb-1 text-[10px] text-muted">
              기준 사진
            </p>
            {location.referencePhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={location.referencePhotoUrl}
                alt="기준 사진"
                className="h-32 w-full rounded-lg border border-line object-cover"
              />
            ) : (
              <div className="flex h-32 w-full items-center justify-center rounded-lg border border-dashed border-line bg-paper-panel text-xs text-muted">
                기준 사진 미등록 (더미 데이터)
              </div>
            )}
          </div>

          {previewUrl && (
            <div>
              <p className="label-tech mb-1 text-[10px] text-muted">
                내가 찍은 사진
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="업로드할 사진"
                className="h-32 w-full rounded-lg border border-line object-cover"
              />
            </div>
          )}

          <div className="flex gap-2">
            <label className="flex-1 cursor-pointer rounded-lg border-2 border-line bg-paper px-3 py-2 text-center text-sm font-medium">
              {file ? "사진 다시 찍기" : "사진 찍기"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
            <button
              onClick={handleSubmit}
              disabled={!file || submitting}
              className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-bold text-paper disabled:opacity-40"
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
    </div>
  );
}
