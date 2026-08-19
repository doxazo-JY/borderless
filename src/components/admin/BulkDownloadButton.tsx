"use client";

import { useState } from "react";
import JSZip from "jszip";

export type DownloadFile = { url: string; filename: string };

// zip 압축을 서버(Vercel 서버리스 함수)에서 하면 영상 용량 때문에 실행시간 제한에
// 걸릴 위험이 있어서, 사용자 브라우저에서 직접 파일들을 받아 zip으로 묶는다 —
// 서버 부담 없이 사용자 기기 자원만 쓴다.
export function BulkDownloadButton({
  files,
  zipNamePrefix = "제출물",
}: {
  files: DownloadFile[];
  zipNamePrefix?: string;
}) {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [error, setError] = useState(false);

  async function handleDownloadAll() {
    if (files.length === 0) return;
    setError(false);
    setProgress({ done: 0, total: files.length });

    try {
      const zip = new JSZip();
      for (let i = 0; i < files.length; i++) {
        const { url, filename } = files[i];
        const res = await fetch(url);
        const blob = await res.blob();
        zip.file(filename, blob);
        setProgress({ done: i + 1, total: files.length });
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const blobUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `borderless-${zipNamePrefix}-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
      setProgress(null);
    } catch {
      setError(true);
      setProgress(null);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownloadAll}
      disabled={progress !== null || files.length === 0}
      className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 disabled:opacity-50"
    >
      {progress
        ? `zip 만드는 중... (${progress.done}/${progress.total})`
        : error
          ? "실패, 다시 시도"
          : `전체 zip 다운로드 (${files.length}개)`}
    </button>
  );
}
