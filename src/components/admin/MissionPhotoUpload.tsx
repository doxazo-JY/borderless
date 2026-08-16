"use client";

import { useState } from "react";
import { updateMissionPhoto } from "@/app/admin/[secret]/setup/actions";
import { supabaseBrowser } from "@/lib/supabase-client";

export function MissionPhotoUpload({
  missionId,
  hasPhoto,
}: {
  missionId: string;
  hasPhoto: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    setError(false);
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

      await updateMissionPhoto(missionId, urlData.path);
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
