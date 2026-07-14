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

export function KakaoMap({ locations }: { locations: MapLocation[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(() =>
    KAKAO_APP_KEY ? "loading" : "error",
  );
  const [locationDenied, setLocationDenied] = useState(false);

  useEffect(() => {
    if (!KAKAO_APP_KEY) {
      console.error("NEXT_PUBLIC_KAKAO_JS_KEY가 설정되지 않았습니다.");
      return;
    }

    function initMap() {
      window.kakao.maps.load(() => {
        if (!containerRef.current) return;

        const bounds = new window.kakao.maps.LatLngBounds();
        const center =
          locations.length > 0
            ? new window.kakao.maps.LatLng(locations[0].lat, locations[0].lng)
            : new window.kakao.maps.LatLng(37.73, 126.43);

        const map = new window.kakao.maps.Map(containerRef.current, {
          center,
          level: 6,
        });

        locations.forEach((loc) => {
          const position = new window.kakao.maps.LatLng(loc.lat, loc.lng);
          bounds.extend(position);

          const marker = new window.kakao.maps.Marker({ position, map });

          const infowindow = new window.kakao.maps.InfoWindow({
            content: `<div style="padding:4px 8px;font-size:12px;white-space:nowrap;">${loc.regionName}지역 · ${loc.name}</div>`,
          });
          window.kakao.maps.event.addListener(marker, "click", () => {
            infowindow.open(map, marker);
          });
        });

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
