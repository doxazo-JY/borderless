"use client";

import { useState } from "react";
import { updateLocationPhoto } from "@/app/admin/[secret]/setup/actions";
import { supabaseBrowser } from "@/lib/supabase-client";

export function LocationPhotoUpload({
  locationId,
  hasPhoto,
}: {
  locationId: string;
  hasPhoto: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    setError(false);
    try {
      // 사진 바이트는 Server Action(요청 본문 4.5MB 제한 있는 Vercel 서버리스
      // 함수를 거침)이 아니라 브라우저 → Supabase Storage로 직접 올린다 —
      // 폰카메라 사진은 이 제한을 쉽게 넘어서 "교체해도 안 바뀌는" 원인이었다.
      const ext = file.name.split(".").pop() || "jpg";
      const urlRes = await fetch("/api/admin/photo-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ext, prefix: "reference" }),
      });
      const urlData = await urlRes.json();
      if (!urlData.ok) throw new Error(urlData.message || "업로드 URL 발급 실패");

      const { error: uploadError } = await supabaseBrowser.storage
        .from(urlData.bucket)
        .uploadToSignedUrl(urlData.path, urlData.token, file);
      if (uploadError) throw uploadError;

      await updateLocationPhoto(locationId, urlData.path);
    } catch {
      setError(true);
    } finally {
      setUploading(false);
    }
  }

  return (
    <label className="cursor-pointer text-[10px] text-blue-600 underline">
      {uploading ? "업로드 중..." : hasPhoto ? "사진 교체" : "사진 추가"}
      {error && <span className="ml-1 text-red-600">(실패, 다시 시도)</span>}
      <input
        type="file"
        accept="image/*"
        disabled={uploading}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) handleFile(file);
        }}
      />
    </label>
  );
}
