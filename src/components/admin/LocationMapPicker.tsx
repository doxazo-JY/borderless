"use client";

import { useEffect, useRef, useState } from "react";
import { loadKakaoServices } from "@/lib/kakao-loader";

const KAKAO_APP_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
// 답사 지역(강화군 송해면 숙소) 인근 기본 중심 — 좌표가 아직 없을 때만 사용
const DEFAULT_CENTER = { lat: 37.73, lng: 126.43 };
// 주소 검색/GPS로 큰 점프를 해도 클릭으로 바로 세부 위치를 찍을 수 있을 만큼
// 충분히 당겨진 줌 레벨(낮을수록 확대). 클릭으로 좌표를 찍을 때도 같은 값으로
// 유지해 지도가 갑자기 넓게 빠지는 느낌이 없게 한다.
const PICK_LEVEL = 3;

export type ExistingMapLocation = {
  id: string;
  name: string;
  regionName: string;
  lat: number;
  lng: number;
};

export function LocationMapPicker({
  lat,
  lng,
  onPick,
  existingLocations = [],
}: {
  lat: string;
  lng: string;
  onPick: (lat: string, lng: string) => void;
  existingLocations?: ExistingMapLocation[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    KAKAO_APP_KEY ? "loading" : "error",
  );
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  // 지도/마커 생성은 최초 1회만 — 이후 좌표 변경은 아래 별도 effect가 마커만 옮긴다.
  useEffect(() => {
    if (!KAKAO_APP_KEY) return;
    let cancelled = false;

    loadKakaoServices()
      .then(() => {
        if (cancelled || !containerRef.current) return;

        const initialLat = Number(lat) || DEFAULT_CENTER.lat;
        const initialLng = Number(lng) || DEFAULT_CENTER.lng;
        const center = new window.kakao.maps.LatLng(initialLat, initialLng);

        const map = new window.kakao.maps.Map(containerRef.current, {
          center,
          level: PICK_LEVEL,
        });
        mapRef.current = map;

        // 기존 등록된 포인트들을 회색 점으로 같이 보여줘서, 새 포인트를 너무 가깝게
        // 찍지 않도록(혹은 의도적으로 근처에 찍도록) 참고할 수 있게 한다.
        existingLocations.forEach((loc) => {
          const dot = document.createElement("div");
          Object.assign(dot.style, {
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            background: "#9ca3af",
            border: "1.5px solid white",
            boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
          });
          dot.title = `${loc.regionName}지역 · ${loc.name}`;
          new window.kakao.maps.CustomOverlay({
            position: new window.kakao.maps.LatLng(loc.lat, loc.lng),
            content: dot,
            map,
            xAnchor: 0.5,
            yAnchor: 0.5,
          });
        });

        const markerEl = document.createElement("div");
        Object.assign(markerEl.style, {
          width: "20px",
          height: "20px",
          borderRadius: "50% 50% 50% 0",
          background: "#e1591c",
          border: "2px solid white",
          boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
          transform: "rotate(-45deg)",
        });
        const marker = new window.kakao.maps.CustomOverlay({
          position: center,
          content: markerEl,
          map,
          xAnchor: 0.5,
          yAnchor: 1,
        });
        markerRef.current = marker;

        window.kakao.maps.event.addListener(
          map,
          "click",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (mouseEvent: { latLng: any }) => {
            const { latLng } = mouseEvent;
            marker.setPosition(latLng);
            onPickRef.current(
              latLng.getLat().toFixed(7),
              latLng.getLng().toFixed(7),
            );
          },
        );

        setStatus("ready");
      })
      .catch(() => setStatus("error"));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 직전 좌표 — 주소 검색/GPS처럼 먼 곳으로 "점프"했는지, 지도 클릭처럼 화면 안
  // 세부 조정인지 구분하는 데 쓴다.
  const prevPosRef = useRef<{ lat: number; lng: number } | null>(null);

  // GPS 버튼/주소 검색/직접 입력으로 좌표가 바뀌면 마커와 지도 중심도 따라간다.
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    const la = Number(lat);
    const ln = Number(lng);
    if (!Number.isFinite(la) || !Number.isFinite(ln)) return;
    const pos = new window.kakao.maps.LatLng(la, ln);
    markerRef.current.setPosition(pos);
    mapRef.current.setCenter(pos);

    // 대략 500m 이상 떨어진 곳으로 옮겨왔으면(주소 검색/GPS) 클릭으로 바로 세부
    // 위치를 찍을 수 있게 다시 당겨준다. 지도 클릭으로 인한 미세 조정은 관리자가
    // 직접 맞춰둔 줌을 존중해 건드리지 않는다.
    const prev = prevPosRef.current;
    const jumped =
      !prev ||
      Math.hypot(la - prev.lat, ln - prev.lng) > 0.005;
    if (jumped) {
      mapRef.current.setLevel(PICK_LEVEL);
    }
    prevPosRef.current = { lat: la, lng: ln };
  }, [lat, lng]);

  return (
    <div className="relative h-56 w-full overflow-hidden rounded border border-zinc-300 bg-zinc-100">
      <div ref={containerRef} className="h-full w-full" />
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-400">
          지도를 불러오는 중...
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-red-600">
          지도를 불러오지 못했어요. 위/경도를 직접 입력해주세요.
        </div>
      )}
      {status === "ready" && (
        <p className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">
          지도를 클릭해서 좌표 지정
        </p>
      )}
    </div>
  );
}
