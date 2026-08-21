"use client";

import { useEffect, useRef, useState } from "react";
import { DownloadLink } from "@/components/admin/DownloadLink";
import { replaceSubmissionVideo } from "@/app/admin/[secret]/gallery/actions";
import { supabaseBrowser } from "@/lib/supabase-client";

export interface PlaylistItem {
  id: string;
  videoUrl: string;
  locationLabel: string;
  slot: number | null;
  content: string;
  downloadName: string;
}

// 미션 타입별로 통과한 영상들을 이어서 재생 — 지역 내 여러 포인트 영상을 합치면
// 성경 본문 낭독/찬양 한 곡이 완성되는 구조라, 하나씩 재생-닫기-재생을 반복하지
// 않도록 대표 카드 하나만 눌러서 모달에서 자동으로 이어보게 한다.
export function MissionPlaylist({
  title,
  items,
  readOnly = false,
}: {
  title: string;
  items: PlaylistItem[];
  readOnly?: boolean;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [replacing, setReplacing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const first = items[0];

  useEffect(() => {
    if (openIndex !== null) {
      videoRef.current?.play().catch(() => {});
    }
  }, [openIndex]);

  useEffect(() => {
    if (openIndex === null) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") setOpenIndex((i) => (i === null ? i : Math.min(i + 1, items.length - 1)));
      if (e.key === "ArrowLeft") setOpenIndex((i) => (i === null ? i : Math.max(i - 1, 0)));
      if (e.key === "Escape") setOpenIndex(null);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [openIndex, items.length]);

  const current = openIndex === null ? null : items[openIndex];

  function handleEnded() {
    setOpenIndex((i) => (i === null ? i : Math.min(i + 1, items.length - 1)));
  }

  async function handleReplaceVideo(file: File) {
    if (!current) return;
    setReplacing(true);
    try {
      const ext = file.name.split(".").pop() || "mp4";
      const urlRes = await fetch("/api/admin/photo-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ext, prefix: "video" }),
      });
      const urlData = await urlRes.json();
      if (!urlData.ok) throw new Error(urlData.message || "업로드 URL 발급 실패");

      const { error: uploadError } = await supabaseBrowser.storage
        .from(urlData.bucket)
        .uploadToSignedUrl(urlData.path, urlData.token, file);
      if (uploadError) throw uploadError;

      await replaceSubmissionVideo(current.id, urlData.path);
      // 최신 videoUrl은 서버에서 조합되므로, 전체 새로고침으로 받아온다.
      window.location.reload();
    } catch (e) {
      console.error("영상 교체 실패:", e);
      alert("영상 교체에 실패했어요. 다시 시도해주세요.");
      setReplacing(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenIndex(0)}
        className="group relative block aspect-video w-full overflow-hidden rounded border border-zinc-200 bg-black text-left"
      >
        <video
          src={`${first.videoUrl}#t=0.5`}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-contain"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 transition group-hover:opacity-100">
          <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium">▶ 이어보기</span>
        </span>
        <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
          {items.length}개
        </span>
        <p className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-2 py-1 text-xs font-medium text-white">
          {title}
        </p>
      </button>

      {current && (
        <div className="fixed inset-0 z-50 bg-black/80" onClick={() => setOpenIndex(null)}>
          <div className="flex h-full items-center justify-center px-20 pb-28 pt-4">
            <video
              key={current.id}
              ref={videoRef}
              src={current.videoUrl}
              controls
              playsInline
              onEnded={handleEnded}
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full rounded bg-black object-contain"
            />
          </div>

          {/* 이전/다음은 영상 크기(세로/가로)와 무관하게 화면 좌우 고정 위치 */}
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
              setOpenIndex((i) => (i === null ? i : Math.min(i + 1, items.length - 1)));
            }}
            disabled={openIndex === items.length - 1}
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
              <span className="text-xs text-white/70">
                {openIndex! + 1} / {items.length}
              </span>
              {!readOnly && (
                <>
                  <DownloadLink url={current.videoUrl} filename={current.downloadName} label="이 영상 받기" />
                  <label className="cursor-pointer text-xs text-emerald-400 underline">
                    {replacing ? "교체 중..." : "영상 교체"}
                    <input
                      type="file"
                      accept="video/*"
                      disabled={replacing}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) handleReplaceVideo(file);
                      }}
                    />
                  </label>
                </>
              )}
              <button type="button" onClick={() => setOpenIndex(null)} className="ml-2 underline">
                닫기
              </button>
            </div>
            <p className="text-center text-xs text-white/70">
              {title} · {current.locationLabel}
              {current.slot ? ` · 슬롯${current.slot}` : ""}
              {current.content ? ` — ${current.content}` : ""}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
