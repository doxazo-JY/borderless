"use client";

import { useEffect, useState } from "react";
import { DownloadLink } from "@/components/admin/DownloadLink";

export interface PhotoItem {
  id: string;
  photoUrl: string;
  label: string;
  downloadName: string;
  passed: boolean;
}

export interface PhotoGroup {
  groupLabel: string;
  items: PhotoItem[]; // 빈 배열이면 아직 제출이 없는 포인트 — 빈 칸으로 표시
  referencePhotoUrl?: string | null; // 있으면 그 포인트 슬라이드 맨 앞에 고정
  referenceDownloadName?: string;
}

type Slide =
  | { kind: "reference"; groupLabel: string; url: string; downloadName: string }
  | { kind: "photo"; groupLabel: string; item: PhotoItem; countIndex: number };

// 회고용으로 사진을 하나씩 눌러서 크게 보고, 그리드로 돌아가지 않고 이전/다음으로 계속
// 넘겨볼 수 있게 하는 라이트박스. groups는 미리 지역·포인트 순으로 정렬돼 들어오고(제출이
// 없는 포인트도 빈 그룹으로 포함), 그리드에는 포인트당 대표 사진(기준 사진이 있으면 그것,
// 없으면 첫 참가자 사진) 하나만 보여준다. 모달에서는 포인트마다 기준 사진이 맨 앞에 고정으로
// 붙고(개수 카운트에는 안 들어감), 그 뒤로 실제 제출 사진들이 전체 순서 그대로 이어진다.
export function PhotoLightbox({ groups }: { groups: PhotoGroup[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const slides: Slide[] = [];
  const groupStartIndex = new Map<string, number>();
  let photoCounter = 0;
  for (const g of groups) {
    groupStartIndex.set(g.groupLabel, slides.length);
    if (g.referencePhotoUrl) {
      slides.push({
        kind: "reference",
        groupLabel: g.groupLabel,
        url: g.referencePhotoUrl,
        downloadName: g.referenceDownloadName ?? "기준사진.jpg",
      });
    }
    for (const item of g.items) {
      photoCounter++;
      slides.push({ kind: "photo", groupLabel: g.groupLabel, item, countIndex: photoCounter });
    }
  }
  const totalPhotos = photoCounter;

  useEffect(() => {
    if (openIndex === null) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") setOpenIndex((i) => (i === null ? i : Math.min(i + 1, slides.length - 1)));
      if (e.key === "ArrowLeft") setOpenIndex((i) => (i === null ? i : Math.max(i - 1, 0)));
      if (e.key === "Escape") setOpenIndex(null);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [openIndex, slides.length]);

  const current = openIndex === null ? null : slides[openIndex];

  return (
    <>
      <div className="grid grid-cols-4 gap-1">
        {groups.map((g) => {
          const thumbUrl = g.referencePhotoUrl ?? g.items[0]?.photoUrl;
          if (!thumbUrl) {
            return (
              <div
                key={g.groupLabel}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded border border-dashed border-zinc-300 bg-zinc-50 p-1 text-center"
              >
                <p className="text-[10px] font-medium text-zinc-400">{g.groupLabel}</p>
                <p className="text-[9px] text-zinc-300">없음</p>
              </div>
            );
          }
          const isReferenceThumb = !!g.referencePhotoUrl;
          const startIndex = groupStartIndex.get(g.groupLabel)!;
          return (
            <button
              key={g.groupLabel}
              type="button"
              onClick={() => setOpenIndex(startIndex)}
              className={`relative rounded border p-0.5 text-left ${
                isReferenceThumb
                  ? "border-sky-200 bg-sky-50"
                  : g.items[0]?.passed
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-red-200 bg-red-50"
              }`}
            >
              <span
                className={`absolute right-1 top-1 rounded px-1 text-[9px] font-medium text-white ${
                  isReferenceThumb ? "bg-sky-500" : g.items[0]?.passed ? "bg-emerald-500" : "bg-red-500"
                }`}
              >
                {isReferenceThumb ? "기준" : g.items[0]?.passed ? "통과" : "실패"}
              </span>
              {g.items.length > 0 && (
                <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[9px] text-white">
                  {g.items.length}장
                </span>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumbUrl} alt="" className="aspect-square w-full rounded object-cover" />
              <p className="mt-0.5 truncate text-[9px] text-zinc-500">{g.groupLabel}</p>
            </button>
          );
        })}
      </div>

      {current && (
        <div className="fixed inset-0 z-50 bg-black/80" onClick={() => setOpenIndex(null)}>
          <div className="flex h-full items-center justify-center px-20 pb-24 pt-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.kind === "reference" ? current.url : current.item.photoUrl}
              alt=""
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full rounded object-contain"
            />
          </div>

          {/* 이전/다음은 사진 크기와 무관하게 화면 좌우 고정 위치 */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenIndex((i) => (i === null ? i : Math.max(i - 1, 0)));
            }}
            disabled={openIndex === 0}
            className="fixed left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-white/10 px-3 py-2 text-lg text-white hover:bg-white/20 disabled:opacity-20"
          >
            ←
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenIndex((i) => (i === null ? i : Math.min(i + 1, slides.length - 1)));
            }}
            disabled={openIndex === slides.length - 1}
            className="fixed right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-white/10 px-3 py-2 text-lg text-white hover:bg-white/20 disabled:opacity-20"
          >
            →
          </button>

          {/* 나머지 컨트롤도 화면 하단 고정 위치 */}
          <div
            className="fixed inset-x-0 bottom-0 flex flex-col items-center gap-1.5 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-white">
              {current.kind === "reference" ? (
                <span className="text-xs text-white/70">기준 사진</span>
              ) : (
                <span className="text-xs text-white/70">
                  {current.countIndex} / {totalPhotos}
                </span>
              )}
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium text-white ${
                  current.kind === "reference"
                    ? "bg-sky-500"
                    : current.item.passed
                      ? "bg-emerald-500"
                      : "bg-red-500"
                }`}
              >
                {current.kind === "reference" ? "기준" : current.item.passed ? "통과" : "실패"}
              </span>
              <DownloadLink
                url={current.kind === "reference" ? current.url : current.item.photoUrl}
                filename={current.kind === "reference" ? current.downloadName : current.item.downloadName}
                label="사진 받기"
              />
              <button type="button" onClick={() => setOpenIndex(null)} className="ml-2 underline">
                닫기
              </button>
            </div>
            <p className="text-xs text-white/70">
              {current.kind === "reference" ? current.groupLabel : current.item.label}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
