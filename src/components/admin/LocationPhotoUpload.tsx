"use client";

import { useRef, useState } from "react";
import { updateLocationPhoto } from "@/app/admin/[secret]/setup/actions";

export function LocationPhotoUpload({
  locationId,
  hasPhoto,
}: {
  locationId: string;
  hasPhoto: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [uploading, setUploading] = useState(false);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        setUploading(true);
        await updateLocationPhoto(formData);
        setUploading(false);
      }}
    >
      <input type="hidden" name="id" value={locationId} />
      <label className="cursor-pointer text-[10px] text-blue-600 underline">
        {uploading ? "업로드 중..." : hasPhoto ? "사진 교체" : "사진 추가"}
        <input
          type="file"
          name="referencePhoto"
          accept="image/*"
          disabled={uploading}
          className="hidden"
          onChange={() => formRef.current?.requestSubmit()}
        />
      </label>
    </form>
  );
}
