"use client";

import { useRef, useState } from "react";
import { createMission } from "@/app/admin/[secret]/setup/actions";
import { supabaseBrowser } from "@/lib/supabase-client";

export function MissionCreateForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // 사진 바이트는 Server Action(요청 본문 4.5MB 제한이 있는 Vercel 서버리스
  // 함수를 거침)이 아니라 브라우저 → Supabase Storage로 직접 올리고, 폼에는
  // 그 결과 경로만 hidden input으로 실어 보낸다.
  async function handlePhotoChange(file: File) {
    setPhotoPath(null);
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const urlRes = await fetch("/api/admin/photo-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ext, prefix: "mission" }),
      });
      const urlData = await urlRes.json();
      if (!urlData.ok) throw new Error(urlData.message || "업로드 URL 발급 실패");

      const { error: uploadError } = await supabaseBrowser.storage
        .from(urlData.bucket)
        .uploadToSignedUrl(urlData.path, urlData.token, file);
      if (uploadError) throw uploadError;

      setPhotoPath(urlData.path);
    } catch {
      setPhotoPath(null);
    } finally {
      setUploading(false);
    }
  }

  async function createAndReset(formData: FormData) {
    await createMission(formData);
    formRef.current?.reset();
    setPhotoPath(null);
  }

  return (
    <form
      ref={formRef}
      action={createAndReset}
      className="flex gap-2 rounded border border-zinc-200 p-3"
    >
      <select name="type" className="rounded border border-zinc-300 p-2 text-sm">
        <option value="WORD">말씀</option>
        <option value="PRAISE">찬양</option>
        <option value="PRAYER">기도</option>
        <option value="CONFESSION">고백</option>
      </select>
      <textarea
        name="content"
        placeholder="본문/기도 주제/고백 지시문 (찬양은 비워둬도 됨). Enter로 줄바꿈 가능"
        rows={2}
        className="h-16 flex-1 resize-y rounded border border-zinc-300 p-2 text-sm"
      />
      <input type="hidden" name="photoPath" value={photoPath ?? ""} />
      <input
        type="file"
        accept="image/*"
        title="문제 사진(선택)"
        disabled={uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handlePhotoChange(file);
        }}
        className="w-32 text-xs"
      />
      <button
        type="submit"
        disabled={uploading}
        className="rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50"
      >
        {uploading ? "업로드 중..." : "추가"}
      </button>
    </form>
  );
}
