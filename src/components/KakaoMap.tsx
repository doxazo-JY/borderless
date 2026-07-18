"use client";

import { useEffect, useRef, useState } from "react";

export type MapLocation = {
  id: string;
  name: string;
  regionName: string;
  lat: number;
  lng: number;
  isPassed?: boolean;
  isClosed?: boolean;
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

function applyPinStatus(pinEl: HTMLDivElement, loc: MapLocation) {
  const statusSuffix = loc.isPassed ? " (통과)" : loc.isClosed ? " (마감)" : "";
  pinEl.title = `${loc.regionName}지역 · ${loc.name}${statusSuffix}`;
  pinEl.style.background = loc.isPassed
    ? "#16a34a"
    : loc.isClosed
      ? "#9ca3af"
      : "#2563eb";
  pinEl.style.opacity = loc.isClosed && !loc.isPassed ? "0.75" : "1";
  pinEl.textContent = loc.isPassed ? "✓" : loc.isClosed ? "✕" : "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getHeadingFromEvent(event: any): number | null {
  if (typeof event.webkitCompassHeading === "number") {
    // iOS Safari — 이미 정북 기준 시계방향 각도
    return event.webkitCompassHeading;
  }
  // absolute가 true일 때만 alpha를 신뢰한다 — 일반 deviceorientation의 alpha는
  // 기기 초기 자세 기준 상대값이라 나침반 방향이 아님(가만히 있어도 안 도는 원인).
  if (event.absolute === true && typeof event.alpha === "number") {
    // Android(deviceorientationabsolute) — alpha는 정북 기준 반시계 방향이라 뒤집어준다
    return (360 - event.alpha) % 360;
  }
  return null;
}

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
  const [needsCompassPermission, setNeedsCompassPermission] = useState(false);
  const onSelectLocationRef = useRef(onSelectLocation);
  useEffect(() => {
    onSelectLocationRef.current = onSelectLocation;
  }, [onSelectLocation]);
  // 개발 모드 StrictMode가 effect를 두 번 실행해도 지도가 중복 생성되지 않도록 가드
  const mapCreatedRef = useRef(false);
  // 통과/마감 상태가 바뀔 때마다 지도(및 마커) 전체를 새로 만들지 않고, 이미 만들어둔
  // 마커 DOM만 찾아서 색을 갱신하기 위한 위치별 참조
  const pinElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  // 내 위치 마커의 방향(나침반) 부채꼴 — DOM을 직접 회전시켜야 해서 ref로 들고 있는다
  const compassConeRef = useRef<HTMLDivElement | null>(null);
  const compassAttachedRef = useRef(false);

  function attachCompass() {
    if (compassAttachedRef.current) return;
    compassAttachedRef.current = true;

    function handleOrientation(event: Event) {
      const heading = getHeadingFromEvent(event);
      if (heading !== null && compassConeRef.current) {
        compassConeRef.current.style.transform = `rotate(${heading}deg)`;
      }
    }

    // 이벤트 이름 사전 감지(`"ondeviceorientationabsolute" in window`)가 브라우저별로
    // 오탐이 있어(그 이벤트가 실제론 안 터지는데도 감지됨), 대신 두 이벤트 다 듣고
    // getHeadingFromEvent가 실제로 신뢰 가능한 값이 들어올 때만 반영하게 한다.
    window.addEventListener("deviceorientationabsolute", handleOrientation);
    window.addEventListener("deviceorientation", handleOrientation);
  }

  function requestCompassPermission() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DOE = (window as any).DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === "function") {
      DOE.requestPermission()
        .then((state: string) => {
          if (state === "granted") {
            attachCompass();
            setNeedsCompassPermission(false);
          }
        })
        .catch(() => {});
    }
  }

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
          Object.assign(pinEl.style, {
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            border: "2px solid white",
            boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
            fontWeight: "bold",
            color: "white",
          });
          applyPinStatus(pinEl, loc);
          pinElsRef.current.set(loc.id, pinEl);

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

              // 실제 축척(반경 15m)으로 그리면 지도 줌 레벨에서 거의 안 보여서,
              // 마커처럼 고정 픽셀 크기의 오버레이로 표시한다. 미션 포인트 핀(파란색)과
              // 절대 헷갈리지 않도록 계열 자체가 다른 마젠타色 + 발광 링을 준다.
              const wrapperEl = document.createElement("div");
              Object.assign(wrapperEl.style, {
                position: "relative",
                width: "46px",
                height: "46px",
                pointerEvents: "none",
              });

              // 폰이 바라보는 방향(나침반) 부채꼴 — 방향 정보가 들어오기 전엔 안 보이게 시작
              const coneEl = document.createElement("div");
              Object.assign(coneEl.style, {
                position: "absolute",
                inset: "0",
                borderRadius: "50%",
                background:
                  "conic-gradient(from -30deg, rgba(230,25,163,0.4) 0deg, rgba(230,25,163,0.4) 60deg, transparent 60deg 360deg)",
                transition: "transform 0.15s linear",
              });
              compassConeRef.current = coneEl;

              const dotEl = document.createElement("div");
              Object.assign(dotEl.style, {
                position: "absolute",
                left: "50%",
                top: "50%",
                width: "16px",
                height: "16px",
                marginLeft: "-8px",
                marginTop: "-8px",
                borderRadius: "50%",
                background: "#e619a3",
                border: "3px solid white",
                boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
              });

              wrapperEl.appendChild(coneEl);
              wrapperEl.appendChild(dotEl);

              new window.kakao.maps.CustomOverlay({
                position: myLatLng,
                content: wrapperEl,
                map,
                xAnchor: 0.5,
                yAnchor: 0.5,
                zIndex: 5,
              });

              bounds.extend(myLatLng);
              map.setBounds(bounds);

              // 나침반 방향: iOS 13+ Safari는 사용자 탭 없이는 권한 요청 자체가 안 되므로
              // 버튼을 띄우고, 그 외 브라우저는 권한 프롬프트가 없어 바로 붙인다.
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const DOE = (window as any).DeviceOrientationEvent;
              if (DOE && typeof DOE.requestPermission === "function") {
                setNeedsCompassPermission(true);
              } else if (typeof DOE !== "undefined") {
                attachCompass();
              }
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

  // 마커 생성 자체는 최초 1회뿐이라(위 effect의 mapCreatedRef 가드), 통과/마감 상태가
  // 바뀌었을 때 지도를 통째로 다시 만들지 않고 이미 그려둔 마커 DOM만 갱신한다 —
  // 그래야 미션 통과 직후 지도를 새로고침하지 않아도 마커 색이 바로 바뀐다.
  useEffect(() => {
    for (const loc of locations) {
      const pinEl = pinElsRef.current.get(loc.id);
      if (pinEl) applyPinStatus(pinEl, loc);
    }
  }, [locations]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {status === "loading" && (
        <div className="label-tech absolute inset-0 flex items-center justify-center bg-paper text-xs text-muted">
          지도를 불러오는 중...
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-paper px-6 text-center text-sm font-medium text-accent">
          지도를 불러오지 못했습니다. Kakao JS 키/도메인 등록을 확인해주세요.
        </div>
      )}
      {status === "ready" && locationDenied && (
        <div className="label-tech absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border-2 border-ink bg-paper px-3 py-1.5 text-[10px] text-ink shadow">
          위치 권한이 없어 내 위치는 표시되지 않아요
        </div>
      )}
      {status === "ready" && needsCompassPermission && (
        <button
          onClick={requestCompassPermission}
          className="label-tech absolute bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full border-2 border-ink bg-accent px-4 py-2.5 text-[11px] font-bold whitespace-nowrap text-white shadow-[0_4px_14px_-2px_rgba(225,89,28,0.6)]"
        >
          🧭 나침반 방향 표시 켜기
        </button>
      )}
    </div>
  );
}
