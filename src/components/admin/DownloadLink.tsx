"use client";

import { useState } from "react";

// 사진/영상이 Supabase Storage(다른 origin)에 있어서, 그냥 <a download href={url}>만
// 걸어두면 브라우저가 강제 다운로드 대신 그냥 새 탭으로 열어버리는 경우가 있다 —
// blob으로 받아와서 같은 origin의 blob: URL을 통해 다운로드를 강제한다.
export function DownloadLink({
  url,
  filename,
  label = "다운로드",
}: {
  url: string;
  filename: string;
  label?: string;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function handleDownload() {
    setStatus("loading");
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={status === "loading"}
      className="text-[10px] text-blue-600 underline disabled:opacity-50"
    >
      {status === "loading" ? "받는 중..." : status === "error" ? "실패, 재시도" : label}
    </button>
  );
}
