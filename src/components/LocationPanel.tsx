"use client";

import { useState } from "react";
import type { MapLocationInfo } from "@/components/MapScreen";

const MISSION_LABEL: Record<string, string> = {
  WORD: "말씀",
  PRAISE: "찬양",
  PRAYER: "기도",
};

type SubmitResult = {
  result: "wrong_region" | "closed" | "failed" | "passed" | string;
  message?: string;
  mission?: { type: string; content: string } | null;
};

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
      const data: SubmitResult = await res.json();
      setResult(data);
    } catch {
      setResult({ result: "failed", message: "업로드 중 오류가 발생했어요. 다시 시도해주세요." });
    } finally {
      setSubmitting(false);
    }
  }

  function resetForRetry() {
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
  }

  // 사진 업로드 UI/미션 공개처럼 내용이 있는 상태만 패널을 넉넉하게 채움.
  // "차례 아님"/"마감"처럼 짧은 안내 문구만 있을 때는 내용만큼만 차지.
  const isRoomy = isCurrentRegion && !location.isClosed;

  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-50 flex max-h-[55%] flex-col overflow-y-auto rounded-t-2xl border-t border-zinc-200 bg-white p-4 shadow-[0_-4px_16px_rgba(0,0,0,0.1)] ${isRoomy ? "min-h-[45%]" : ""}`}
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="text-xs text-zinc-500">{location.regionName}지역</p>
          <h2 className="text-base font-bold">{location.name}</h2>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-zinc-400 underline underline-offset-2"
        >
          닫기
        </button>
      </div>

      {!isCurrentRegion ? (
        <p className="text-sm text-zinc-600">
          아직 이 지역으로 갈 차례가 아니에요.
          {targetRegionName && ` 다음 목적지는 ${targetRegionName}지역입니다.`}
        </p>
      ) : location.isClosed ? (
        <p className="text-sm text-zinc-600">
          이미 마감된 포인트예요. 같은 지역의 다른 포인트로 가보세요.
        </p>
      ) : result?.result === "passed" ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-green-700">통과! 🎉</p>
          {result.message && (
            <p className="text-xs text-zinc-500">{result.message}</p>
          )}
          {result.mission && (
            <div className="rounded-lg border border-zinc-200 p-3">
              <p className="text-xs font-semibold text-zinc-500">
                {MISSION_LABEL[result.mission.type] ?? result.mission.type} 미션
              </p>
              <p className="mt-1 text-sm">
                {result.mission.content || "자유곡으로 찬양해주세요."}
              </p>
            </div>
          )}
        </div>
      ) : result?.result === "closed" ? (
        <div className="space-y-2">
          <p className="text-sm text-zinc-600">{result.message}</p>
        </div>
      ) : result?.result === "wrong_region" ? (
        <p className="text-sm text-zinc-600">{result.message}</p>
      ) : (
        <div className="space-y-3">
          {result?.result === "failed" && (
            <p className="text-sm text-red-600">{result.message}</p>
          )}

          <div>
            <p className="mb-1 text-xs font-semibold text-zinc-500">
              기준 사진
            </p>
            {location.referencePhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={location.referencePhotoUrl}
                alt="기준 사진"
                className="h-32 w-full rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-32 w-full items-center justify-center rounded-lg bg-zinc-100 text-xs text-zinc-400">
                기준 사진 미등록 (더미 데이터)
              </div>
            )}
          </div>

          {previewUrl && (
            <div>
              <p className="mb-1 text-xs font-semibold text-zinc-500">
                내가 찍은 사진
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="업로드할 사진"
                className="h-32 w-full rounded-lg object-cover"
              />
            </div>
          )}

          <div className="flex gap-2">
            <label className="flex-1 cursor-pointer rounded-lg border border-zinc-300 px-3 py-2 text-center text-sm font-medium">
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
              className="flex-1 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {submitting ? "판정 중..." : "제출하기"}
            </button>
          </div>

          {result?.result === "failed" && (
            <button
              onClick={resetForRetry}
              className="text-xs text-zinc-400 underline underline-offset-2"
            >
              처음부터 다시
            </button>
          )}
        </div>
      )}
    </div>
  );
}
