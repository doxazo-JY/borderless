"use client";

import { useEffect, useRef, useState } from "react";
import { createLocation } from "@/app/admin/[secret]/setup/actions";
import {
  LocationMapPicker,
  type ExistingMapLocation,
} from "@/components/admin/LocationMapPicker";
import { supabaseBrowser } from "@/lib/supabase-client";

type Option = { id: string; label: string };

export function LocationForm({
  regions,
  missions,
  ingredients,
  existingLocations = [],
}: {
  regions: Option[];
  missions: Option[];
  ingredients: Option[];
  existingLocations?: ExistingMapLocation[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [gpsStatus, setGpsStatus] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [addressStatus, setAddressStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  async function createAndReset(formData: FormData) {
    await createLocation(formData);
    formRef.current?.reset();
    setAddress("");
    setLat("");
    setLng("");
    setGpsStatus("idle");
    setAddressStatus("idle");
    setPhotoPreview(null);
    setPhotoPath(null);
  }

  // 사진 바이트는 Server Action(요청 본문 4.5MB 제한이 있는 Vercel 서버리스
  // 함수를 거침)이 아니라 브라우저 → Supabase Storage로 직접 올리고, 폼에는
  // 그 결과 경로만 hidden input으로 실어 보낸다 — 폰카메라 사진은 그 제한을
  // 쉽게 넘어서 등록 자체가 조용히 실패하는 원인이었다.
  async function handlePhotoChange(file: File) {
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoPath(null);
    setPhotoUploading(true);
    try {
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

      setPhotoPath(urlData.path);
    } catch {
      setPhotoPath(null);
    } finally {
      setPhotoUploading(false);
    }
  }

  // 좌표가 바뀔 때마다(지도 클릭/GPS/직접 입력) 주소 입력창 자체에 현재 주소를
  // 역지오코딩해서 채워둔다 — 다른 지도(네이버 등)에서 대조 검색할 때 복붙하기
  // 좋고, 등록되는 address 필드도 항상 실제 핀 위치와 맞게 유지된다.
  useEffect(() => {
    const la = Number(lat);
    const ln = Number(lng);
    if (!Number.isFinite(la) || !Number.isFinite(ln)) return;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/reverse-geocode?lat=${la}&lng=${ln}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.ok) setAddress(data.address);
      } catch {
        // 조용히 무시 — 주소칸이 그냥 안 채워질 뿐, 위/경도 직접 수정은 계속 가능
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [lat, lng]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setGpsStatus("error");
      return;
    }
    setGpsStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toFixed(7));
        setLng(position.coords.longitude.toFixed(7));
        setGpsStatus("idle");
      },
      () => setGpsStatus("error"),
    );
  }

  async function findByAddress() {
    if (!address.trim()) {
      setAddressStatus("error");
      return;
    }
    setAddressStatus("loading");
    try {
      const res = await fetch(
        `/api/geocode?query=${encodeURIComponent(address.trim())}`,
      );
      const data = await res.json();
      if (res.ok && data.ok) {
        setLat(data.lat.toFixed(7));
        setLng(data.lng.toFixed(7));
        setAddressStatus("idle");
      } else {
        setAddressStatus("error");
      }
    } catch {
      setAddressStatus("error");
    }
  }

  return (
    <form
      ref={formRef}
      action={createAndReset}
      className="space-y-3 rounded-lg border border-zinc-200 p-4"
    >
      <h3 className="text-sm font-bold">새 포인트 추가</h3>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-zinc-500">
          지역
          <select
            name="regionId"
            required
            className="mt-1 w-full rounded border border-zinc-300 p-2 text-sm"
          >
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-zinc-500">
          이름
          <input
            name="name"
            required
            placeholder="예: 저수지 벤치"
            className="mt-1 w-full rounded border border-zinc-300 p-2 text-sm"
          />
        </label>
      </div>

      <label className="block text-xs text-zinc-500">
        주소 (선택 — 검색하면 아래 지도가 그 근처로 이동해요)
        <div className="mt-1 flex gap-2">
          <input
            name="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="flex-1 rounded border border-zinc-300 p-2 text-sm"
          />
          <button
            type="button"
            onClick={findByAddress}
            className="shrink-0 rounded border border-zinc-300 px-2 py-1 text-xs font-medium"
          >
            {addressStatus === "loading" ? "찾는 중..." : "주소로 지도 이동"}
          </button>
        </div>
        {addressStatus === "error" && (
          <p className="mt-1 text-xs text-red-600">
            좌표를 찾지 못했어요. 주소를 다시 확인하거나 아래 지도를 직접
            움직여 위치를 찍어주세요.
          </p>
        )}
      </label>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs text-zinc-500">
            지도를 클릭해서 정확한 위치를 찍어주세요 (회색 점 = 이미 등록된
            포인트)
          </p>
          <button
            type="button"
            onClick={useMyLocation}
            className="shrink-0 rounded border border-zinc-300 px-2 py-1 text-xs font-medium"
          >
            {gpsStatus === "loading" ? "위치 확인 중..." : "내 위치로 이동"}
          </button>
        </div>
        {gpsStatus === "error" && (
          <p className="mb-1 text-xs text-red-600">
            위치를 가져오지 못했어요. 아래 지도를 직접 움직여 위치를
            찍어주세요.
          </p>
        )}
        <LocationMapPicker
          lat={lat}
          lng={lng}
          onPick={(la, ln) => {
            setLat(la);
            setLng(ln);
          }}
          existingLocations={existingLocations}
        />
        <p className="mt-1 mb-1 text-xs text-zinc-500">
          찍힌 좌표 (직접 수정도 가능)
        </p>
        <div className="grid grid-cols-2 gap-3">
          <input
            name="lat"
            required
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="위도"
            className="rounded border border-zinc-300 p-2 text-sm"
          />
          <input
            name="lng"
            required
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="경도"
            className="rounded border border-zinc-300 p-2 text-sm"
          />
        </div>
      </div>

      <label className="block text-xs text-zinc-500">
        기준 사진
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handlePhotoChange(f);
          }}
          className="mt-1 w-full text-sm"
        />
      </label>
      <input type="hidden" name="referencePhotoPath" value={photoPath ?? ""} />
      {photoUploading && (
        <p className="text-xs text-zinc-500">사진 업로드 중...</p>
      )}
      {photoPreview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoPreview}
          alt="미리보기"
          className="h-32 w-full rounded bg-zinc-100 object-contain"
        />
      )}

      <label className="block text-xs text-zinc-500">
        판정 질문 (비워두면 공통 기본값 사용)
        <textarea
          name="judgePrompt"
          placeholder="기준 사진과 동일한 장소/사물이 보이는가?"
          className="mt-1 h-16 w-full resize-none rounded border border-zinc-300 p-2 text-sm transition-[height] focus:h-32"
        />
      </label>

      <label className="block text-xs text-zinc-500">
        연결 미션 1 (슬롯1 — 먼저 도착한 조, 선택 · 나중에 채워도 됨)
        <select
          name="mission1Id"
          className="mt-1 w-full rounded border border-zinc-300 p-2 text-sm"
        >
          <option value="">(없음)</option>
          {missions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-xs text-zinc-500">
        연결 미션 2 (슬롯2 — 나중 도착한 조, 선택 · 나중에 채워도 됨)
        <select
          name="mission2Id"
          className="mt-1 w-full rounded border border-zinc-300 p-2 text-sm"
        >
          <option value="">(없음)</option>
          {missions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="text-xs text-zinc-500">
        <legend className="mb-1">연결 재료 (선택)</legend>
        <div className="flex flex-wrap gap-2">
          {ingredients.map((ing) => (
            <label
              key={ing.id}
              className="flex items-center gap-1 rounded border border-zinc-300 px-2 py-1"
            >
              <input type="checkbox" name="ingredientIds" value={ing.id} />
              {ing.label}
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={photoUploading}
        className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {photoUploading ? "사진 업로드 중..." : "포인트 추가"}
      </button>
    </form>
  );
}
