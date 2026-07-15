"use client";

import { useState } from "react";
import { createLocation } from "@/app/admin/[secret]/setup/actions";

type Option = { id: string; label: string };

export function LocationForm({
  regions,
  missions,
  ingredients,
}: {
  regions: Option[];
  missions: Option[];
  ingredients: Option[];
}) {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [gpsStatus, setGpsStatus] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

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

  return (
    <form
      action={createLocation}
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
        주소 (선택, 사전 계획용)
        <input
          name="address"
          className="mt-1 w-full rounded border border-zinc-300 p-2 text-sm"
        />
      </label>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs text-zinc-500">좌표</p>
          <button
            type="button"
            onClick={useMyLocation}
            className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium"
          >
            {gpsStatus === "loading" ? "위치 확인 중..." : "내 위치 사용"}
          </button>
        </div>
        {gpsStatus === "error" && (
          <p className="mb-1 text-xs text-red-600">
            위치를 가져오지 못했어요. 위/경도를 직접 입력해주세요.
          </p>
        )}
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
          name="referencePhoto"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setPhotoPreview(f ? URL.createObjectURL(f) : null);
          }}
          className="mt-1 w-full text-sm"
        />
      </label>
      {photoPreview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoPreview}
          alt="미리보기"
          className="h-32 w-full rounded object-cover"
        />
      )}

      <label className="block text-xs text-zinc-500">
        판정 질문 (비워두면 공통 기본값 사용)
        <textarea
          name="judgePrompt"
          rows={2}
          placeholder="기준 사진과 동일한 장소/사물이 보이는가?"
          className="mt-1 w-full rounded border border-zinc-300 p-2 text-sm"
        />
      </label>

      <label className="block text-xs text-zinc-500">
        연결 미션 (선택, 나중에 채워도 됨)
        <select
          name="missionId"
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
        className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
      >
        포인트 추가
      </button>
    </form>
  );
}
