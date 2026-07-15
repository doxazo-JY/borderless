"use client";

import { useEffect, useRef, useState } from "react";

export type MapLocation = {
  id: string;
  name: string;
  regionName: string;
  lat: number;
  lng: number;
};

declare global {
  interface Window {
    // Kakao Maps SDK는 공식 타입 제공을 안 함
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    kakao: any;
  }
}

const SCRIPT_ID = "kakao-maps-sdk";
const KAKAO_APP_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;

export function KakaoMap({
  locations,
  onSelectLocation,
}: {
  locations: MapLocation[];
  onSelectLocation?: (locationId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(() =>
    KAKAO_APP_KEY ? "loading" : "error",
  );
  const [locationDenied, setLocationDenied] = useState(false);
  const onSelectLocationRef = useRef(onSelectLocation);
  useEffect(() => {
    onSelectLocationRef.current = onSelectLocation;
  }, [onSelectLocation]);
  // 개발 모드 StrictMode가 effect를 두 번 실행해도 지도가 중복 생성되지 않도록 가드
  const mapCreatedRef = useRef(false);

  useEffect(() => {
    if (!KAKAO_APP_KEY) {
      console.error("NEXT_PUBLIC_KAKAO_JS_KEY가 설정되지 않았습니다.");
      return;
    }

    function initMap() {
      window.kakao.maps.load(() => {
        if (!containerRef.current) return;
        if (mapCreatedRef.current) return;
        mapCreatedRef.current = true;

        const bounds = new window.kakao.maps.LatLngBounds();
        const center =
          locations.length > 0
            ? new window.kakao.maps.LatLng(locations[0].lat, locations[0].lng)
            : new window.kakao.maps.LatLng(37.73, 126.43);

        const map = new window.kakao.maps.Map(containerRef.current, {
          center,
          level: 6,
        });

        // 마커는 시각적 표시용(CustomOverlay)으로만 두고, 클릭 판정은 지도 자체의
        // click 이벤트(가장 기본적이고 안정적인 기능) + 좌표 거리 계산으로 직접 처리한다.
        // 개별 마커/오버레이의 자체 클릭 판정은 이 환경에서 카카오 내부 드래그 판정과
        // 얽혀 씹히는 문제가 있어 신뢰할 수 없었음.
        locations.forEach((loc) => {
          const position = new window.kakao.maps.LatLng(loc.lat, loc.lng);
          bounds.extend(position);

          const pinEl = document.createElement("div");
          pinEl.title = `${loc.regionName}지역 · ${loc.name}`;
          Object.assign(pinEl.style, {
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            background: "#2563eb",
            border: "2px solid white",
            boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
            pointerEvents: "none",
          });

          new window.kakao.maps.CustomOverlay({
            position,
            content: pinEl,
            map,
            xAnchor: 0.5,
            yAnchor: 0.5,
          });
        });

        const HIT_RADIUS_PX = 22;
        window.kakao.maps.event.addListener(
          map,
          "click",
          (mouseEvent: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            latLng: any;
          }) => {
            const proj = map.getProjection();
            const clickPoint = proj.pointFromCoords(mouseEvent.latLng);

            let closest: (typeof locations)[number] | null = null;
            let closestDist = Infinity;
            for (const loc of locations) {
              const locPoint = proj.pointFromCoords(
                new window.kakao.maps.LatLng(loc.lat, loc.lng),
              );
              const dist = Math.hypot(
                clickPoint.x - locPoint.x,
                clickPoint.y - locPoint.y,
              );
              if (dist < closestDist) {
                closestDist = dist;
                closest = loc;
              }
            }

            if (closest && closestDist <= HIT_RADIUS_PX) {
              onSelectLocationRef.current?.(closest.id);
            }
          },
        );

        if (locations.length > 0) {
          map.setBounds(bounds);
        }

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const myLatLng = new window.kakao.maps.LatLng(
                position.coords.latitude,
                position.coords.longitude,
              );

              new window.kakao.maps.Circle({
                center: myLatLng,
                radius: 15,
                strokeWeight: 2,
                strokeColor: "#3B82F6",
                strokeOpacity: 0.9,
                fillColor: "#3B82F6",
                fillOpacity: 0.6,
                map,
              });

              bounds.extend(myLatLng);
              map.setBounds(bounds);
            },
            (error) => {
              console.warn("위치 권한 거부 또는 오류:", error);
              setLocationDenied(true);
            },
          );
        } else {
          setLocationDenied(true);
        }

        setStatus("ready");
      });
    }

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

    if (window.kakao?.maps) {
      initMap();
    } else if (script) {
      script.addEventListener("load", initMap);
    } else {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}&autoload=false&libraries=services`;
      script.async = true;
      script.onload = initMap;
      script.onerror = () => setStatus("error");
      document.head.appendChild(script);
    }
  }, [locations]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-50 text-sm text-zinc-500">
          지도를 불러오는 중...
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-50 px-6 text-center text-sm text-red-500">
          지도를 불러오지 못했습니다. Kakao JS 키/도메인 등록을 확인해주세요.
        </div>
      )}
      {status === "ready" && locationDenied && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-xs text-white">
          위치 권한이 없어 내 위치는 표시되지 않아요
        </div>
      )}
    </div>
  );
}
