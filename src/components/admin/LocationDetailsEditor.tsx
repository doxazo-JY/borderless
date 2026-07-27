"use client";

import { useEffect, useState } from "react";
import { updateLocationDetails } from "@/app/admin/[secret]/setup/actions";
import { loadKakaoServices } from "@/lib/kakao-loader";
import {
  LocationMapPicker,
  type ExistingMapLocation,
} from "@/components/admin/LocationMapPicker";

type Option = { id: string; label: string };

const KAKAO_APP_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;

export function LocationDetailsEditor({
  locationId,
  currentName,
  currentLat,
  currentLng,
  currentMission1Id,
  currentMission2Id,
  currentIngredientIds,
  currentJudgePrompt,
  missions,
  ingredients,
  existingLocations = [],
}: {
  locationId: string;
  currentName: string;
  currentLat: number;
  currentLng: number;
  currentMission1Id: string | null;
  currentMission2Id: string | null;
  currentIngredientIds: string[];
  currentJudgePrompt: string;
  missions: Option[];
  ingredients: Option[];
  existingLocations?: ExistingMapLocation[];
}) {
  const [open, setOpen] = useState(false);
  const [lat, setLat] = useState(String(currentLat));
  const [lng, setLng] = useState(String(currentLng));
  const [address, setAddress] = useState("");
  const [gpsStatus, setGpsStatus] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [addressStatus, setAddressStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");

  // 좌표(직접 입력/지도 클릭/GPS/주소 검색으로 바뀐 값)를 역지오코딩해서 "주소 검색"
  // 입력창 자체에 현재 주소를 채워둔다 — 등록된 address 필드는 GPS로 찍은 포인트엔
  // 아예 없는 경우가 많고 오래돼서 실제 좌표와 어긋날 수도 있어서, 항상 지금 좌표
  // 기준으로 새로 구한다. 타이핑 중 매 글자마다 요청하지 않도록 살짝 debounce.
  useEffect(() => {
    if (!open || !KAKAO_APP_KEY) return;
    const la = Number(lat);
    const ln = Number(lng);
    if (!Number.isFinite(la) || !Number.isFinite(ln)) return;

    const timer = setTimeout(async () => {
      try {
        await loadKakaoServices();
        const geocoder = new window.kakao.maps.services.Geocoder();
        geocoder.coord2Address(
          ln,
          la,
          (
            result: {
              address?: { address_name: string };
              road_address?: { address_name: string };
            }[],
            status: string,
          ) => {
            if (status === window.kakao.maps.services.Status.OK && result[0]) {
              setAddress(
                result[0].road_address?.address_name ??
                  result[0].address?.address_name ??
                  "",
              );
            }
          },
        );
      } catch {
        // 조용히 무시 — 주소칸이 그냥 안 채워질 뿐, 위/경도 직접 수정은 계속 가능
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [open, lat, lng]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[10px] text-blue-600 underline"
      >
        이름/위치/미션/재료/판정질문 수정
      </button>
    );
  }

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
    if (!address.trim() || !KAKAO_APP_KEY) {
      setAddressStatus("error");
      return;
    }
    setAddressStatus("loading");
    try {
      await loadKakaoServices();
      const geocoder = new window.kakao.maps.services.Geocoder();
      geocoder.addressSearch(
        address.trim(),
        (result: { y: string; x: string }[], status: string) => {
          if (status === window.kakao.maps.services.Status.OK && result[0]) {
            setLat(Number(result[0].y).toFixed(7));
            setLng(Number(result[0].x).toFixed(7));
            setAddressStatus("idle");
          } else {
            setAddressStatus("error");
          }
        },
      );
    } catch {
      setAddressStatus("error");
    }
  }

  return (
    <form
      action={async (formData) => {
        await updateLocationDetails(formData);
        setOpen(false);
      }}
      className="mt-1 space-y-1.5 rounded border border-zinc-200 bg-zinc-50 p-2"
    >
      <input type="hidden" name="id" value={locationId} />
      <input
        name="name"
        defaultValue={currentName}
        placeholder="포인트 이름"
        className="w-full rounded border border-zinc-300 p-1 text-[10px]"
      />

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-[10px] text-zinc-500">
            지도를 클릭해서 위치 다시 찍기
          </p>
          <button
            type="button"
            onClick={useMyLocation}
            className="shrink-0 rounded border border-zinc-300 px-1.5 py-0.5 text-[10px] font-medium"
          >
            {gpsStatus === "loading" ? "확인 중..." : "내 위치로 이동"}
          </button>
        </div>
        <div className="mb-1 flex gap-1">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="주소 검색 (선택)"
            className="flex-1 rounded border border-zinc-300 p-1 text-[10px]"
          />
          <button
            type="button"
            onClick={findByAddress}
            className="shrink-0 rounded border border-zinc-300 px-1.5 py-0.5 text-[10px] font-medium"
          >
            {addressStatus === "loading" ? "찾는 중..." : "이동"}
          </button>
        </div>
        <LocationMapPicker
          lat={lat}
          lng={lng}
          onPick={(la, ln) => {
            setLat(la);
            setLng(ln);
          }}
          existingLocations={existingLocations}
        />
        <div className="mt-1 grid grid-cols-2 gap-1">
          <input
            name="lat"
            required
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="위도"
            className="rounded border border-zinc-300 p-1 text-[10px]"
          />
          <input
            name="lng"
            required
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="경도"
            className="rounded border border-zinc-300 p-1 text-[10px]"
          />
        </div>
      </div>

      <textarea
        name="judgePrompt"
        defaultValue={currentJudgePrompt}
        placeholder="판정 질문"
        // 평소엔 2줄만 보이다가, 클릭(포커스)하면 늘어나서 긴 질문도 한눈에
        // 구분할 수 있게 한다 — 목록에서 여러 개를 스캔할 땐 짧게, 실제로
        // 수정할 땐 크게.
        className="h-12 w-full resize-none rounded border border-zinc-300 p-1 text-[10px] transition-[height] focus:h-28"
      />
      <select
        name="mission1Id"
        defaultValue={currentMission1Id ?? ""}
        className="w-full rounded border border-zinc-300 p-1 text-[10px]"
      >
        <option value="">슬롯1 (없음)</option>
        {missions.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
      <select
        name="mission2Id"
        defaultValue={currentMission2Id ?? ""}
        className="w-full rounded border border-zinc-300 p-1 text-[10px]"
      >
        <option value="">슬롯2 (없음)</option>
        {missions.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-1">
        {ingredients.map((ing) => (
          <label
            key={ing.id}
            className="flex items-center gap-1 rounded border border-zinc-300 px-1.5 py-0.5 text-[10px]"
          >
            <input
              type="checkbox"
              name="ingredientIds"
              value={ing.id}
              defaultChecked={currentIngredientIds.includes(ing.id)}
            />
            {ing.label}
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded bg-zinc-900 px-2 py-1 text-[10px] text-white"
        >
          저장
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[10px] text-zinc-500 underline"
        >
          취소
        </button>
      </div>
    </form>
  );
}
