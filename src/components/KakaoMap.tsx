"use client";

import { useEffect, useRef, useState } from "react";

export type MapLocation = {
  id: string;
  name: string;
  regionName: string;
  lat: number;
  lng: number;
  isPassed?: boolean; // 사진 판정 통과
  isMissionDone?: boolean; // 미션 완료(영상 업로드 또는 PUZZLE 정답 제출)까지 끝남
  isClosed?: boolean;
  // 지금 차례인 지역의 미시도 포인트이거나 본인이 통과한 포인트 — 그 외(아직 차례
  // 아닌 지역, 이미 다른 포인트에서 통과해버린 지역의 나머지 포인트)는 흐리게 표시
  isRelevant?: boolean;
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
const COMPASS_PREFERENCE_KEY = "borderless-compass-enabled";

// 범례가 실제 마커(색 원 + 흰 테두리 + 알파벳/기호)와 똑같이 보이도록, 별도 점 대신
// 실제 마커를 축소한 모양을 그대로 그려서 보여준다.
function LegendPin({ color, text }: { color: string; text: string }) {
  return (
    <span
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white text-[7px] font-bold text-white"
      style={{ background: color, boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }}
    >
      {text}
    </span>
  );
}

// 선택된 마커는 색을 바꾸지 않고, 원래 상태 색을 살짝 어둡게 낮춰서 강조한다
// (다른 색 링을 두르면 상태 색과 안 어울려 튀어 보였음).
function darken(hex: string, percent: number): string {
  const num = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.max(0, (num >> 16) - amt);
  const g = Math.max(0, ((num >> 8) & 0x00ff) - amt);
  const b = Math.max(0, (num & 0x0000ff) - amt);
  return `#${(0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1)}`;
}

function applyPinStatus(
  pinEl: HTMLDivElement,
  loc: MapLocation,
  isSelected: boolean,
) {
  const statusSuffix = loc.isMissionDone
    ? " (완료)"
    : loc.isPassed
      ? " (완료 대기)"
      : loc.isClosed
        ? " (마감)"
        : "";
  pinEl.title = `${loc.regionName}지역 · ${loc.name}${statusSuffix}`;
  const baseColor = loc.isMissionDone
    ? "#16a34a" // 완료(영상 업로드 또는 정답 제출까지)
    : loc.isPassed
      ? "#e1591c" // 사진만 통과, 완료 대기 — 앱 액센트 컬러와 통일
      : loc.isClosed
        ? "#9ca3af"
        : "#2563eb";
  pinEl.style.background = isSelected ? darken(baseColor, 25) : baseColor;
  // 차례가 아닌 지역/이미 다른 포인트에서 통과해버린 지역의 나머지 포인트는 흐리게
  // 눌러서, 지금 실제로 갈 수 있는 포인트가 상대적으로 도드라져 보이게 한다.
  pinEl.style.opacity =
    loc.isRelevant === false
      ? "0.35"
      : loc.isClosed && !loc.isPassed
        ? "0.75"
        : "1";
  // 선택된 마커는 겹친 것들 사이에서도 뭘 골랐는지 바로 보이도록 살짝 확대한다.
  pinEl.style.width = isSelected ? "30px" : "24px";
  pinEl.style.height = isSelected ? "30px" : "24px";
  pinEl.style.fontSize = isSelected ? "11px" : "10px";
  pinEl.style.boxShadow = "0 1px 4px rgba(0,0,0,0.5)";
  // 지역 구분이 안 돼 있으면 마커만 봐선 어느 지역인지 알 수 없었다 — 지역 알파벳을
  // 항상 표시하고, 상태 기호는 그 뒤에 붙여서 같이 보여준다.
  const regionLetter = loc.regionName.toUpperCase();
  const statusSymbol = loc.isMissionDone
    ? "✓"
    : loc.isPassed
      ? "▶"
      : loc.isClosed
        ? "✕"
        : "";
  pinEl.textContent = `${regionLetter}${statusSymbol}`;
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
  selectedLocationId,
}: {
  locations: MapLocation[];
  onSelectLocation?: (locationId: string) => void;
  selectedLocationId?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(() =>
    KAKAO_APP_KEY ? "loading" : "error",
  );
  const [showLegend, setShowLegend] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [needsCompassPermission, setNeedsCompassPermission] = useState(false);
  const onSelectLocationRef = useRef(onSelectLocation);
  useEffect(() => {
    onSelectLocationRef.current = onSelectLocation;
  }, [onSelectLocation]);
  // 개발 모드 StrictMode가 effect를 두 번 실행해도 지도가 중복 생성되지 않도록 가드
  const mapCreatedRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // 통과/마감 상태가 바뀔 때마다 지도(및 마커) 전체를 새로 만들지 않고, 이미 만들어둔
  // 마커 DOM만 찾아서 색을 갱신하기 위한 위치별 참조
  const pinElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  // 선택된 마커를 시각적으로 맨 앞에 오게 하기 위한 오버레이 참조
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overlaysRef = useRef<Map<string, any>>(new Map());
  // 내 위치 마커의 방향(나침반) 부채꼴 — DOM을 직접 회전시켜야 해서 ref로 들고 있는다
  const compassConeRef = useRef<HTMLDivElement | null>(null);
  const compassAttachedRef = useRef(false);
  const headingReceivedRef = useRef(false);

  function attachCompass() {
    if (compassAttachedRef.current) return;
    compassAttachedRef.current = true;

    function handleOrientation(event: Event) {
      const heading = getHeadingFromEvent(event);
      if (heading !== null && compassConeRef.current) {
        headingReceivedRef.current = true;
        compassConeRef.current.style.transform = `rotate(${heading}deg)`;
        setNeedsCompassPermission(false);
      }
    }

    // 이벤트 이름 사전 감지(`"ondeviceorientationabsolute" in window`)가 브라우저별로
    // 오탐이 있어(그 이벤트가 실제론 안 터지는데도 감지됨), 대신 두 이벤트 다 듣고
    // getHeadingFromEvent가 실제로 신뢰 가능한 값이 들어올 때만 반영하게 한다.
    window.addEventListener("deviceorientationabsolute", handleOrientation);
    window.addEventListener("deviceorientation", handleOrientation);
  }

  function requestCompassPermission() {
    window.localStorage.setItem(COMPASS_PREFERENCE_KEY, "true");
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
    } else {
      attachCompass();
      setNeedsCompassPermission(false);
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
        mapInstanceRef.current = map;

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
            fontSize: "10px",
            fontWeight: "bold",
            color: "white",
          });
          applyPinStatus(pinEl, loc, false);
          pinElsRef.current.set(loc.id, pinEl);

          const overlay = new window.kakao.maps.CustomOverlay({
            position,
            content: pinEl,
            map,
            xAnchor: 0.5,
            yAnchor: 0.5,
            zIndex: 1,
          });
          overlaysRef.current.set(loc.id, overlay);
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
              const compassWasEnabled =
                window.localStorage.getItem(COMPASS_PREFERENCE_KEY) === "true";
              if (DOE && typeof DOE.requestPermission === "function") {
                if (compassWasEnabled) {
                  attachCompass();
                  window.setTimeout(() => {
                    if (!headingReceivedRef.current) {
                      setNeedsCompassPermission(true);
                    }
                  }, 1200);
                } else {
                  setNeedsCompassPermission(true);
                }
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

  // 마커 생성 자체는 최초 1회뿐이라(위 effect의 mapCreatedRef 가드), 통과/마감 상태나
  // 선택 여부가 바뀌었을 때 지도를 통째로 다시 만들지 않고 이미 그려둔 마커 DOM만
  // 갱신한다 — 그래야 미션 통과 직후 지도를 새로고침하지 않아도 마커 색이 바로 바뀐다.
  useEffect(() => {
    for (const loc of locations) {
      const isSelected = loc.id === selectedLocationId;
      const pinEl = pinElsRef.current.get(loc.id);
      if (pinEl) applyPinStatus(pinEl, loc, isSelected);
      overlaysRef.current.get(loc.id)?.setZIndex(isSelected ? 100 : 1);
    }
  }, [locations, selectedLocationId]);

  // 카카오 지도는 컨테이너 크기가 바뀌어도(예: PC 화면에서 옆에 패널이 열리고 닫히며
  // 지도 폭이 변할 때) 스스로 다시 그리지 않아 빈 회색 영역이 생긴다 —
  // ResizeObserver로 감지해서 relayout()을 호출해준다.
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      mapInstanceRef.current?.relayout();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

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
      {status === "ready" && (
        // 우상단은 "다음 목적지/영상 업로드 남음" 배지가 진행률에 따라 지도 위쪽
        // 좌우로 움직이며 겹칠 수 있어, 그 배지가 절대 닿지 않는 우하단에 둔다.
        <div className="absolute right-2 bottom-2 z-40">
          {showLegend && (
            <div className="label-tech absolute right-0 bottom-full mb-1 space-y-1 rounded-md border border-line bg-paper-panel p-2 text-[10px] text-ink shadow-[0_4px_12px_-4px_rgba(20,18,12,0.3)]">
              <div className="whitespace-nowrap text-muted">
                알파벳 = 지역, 뒤 기호 = 진행 상태
              </div>
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <LegendPin color="#2563eb" text="A" />
                미시도
              </div>
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <LegendPin color="#e1591c" text="A▶" />
                통과 · 완료 대기
              </div>
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <LegendPin color="#16a34a" text="A✓" />
                완료
              </div>
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <LegendPin color="#9ca3af" text="A✕" />
                마감
              </div>
            </div>
          )}
          <button
            onClick={() => setShowLegend((v) => !v)}
            aria-label="마커 색 설명"
            className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink bg-paper-panel text-xs font-bold text-ink shadow"
          >
            ?
          </button>
        </div>
      )}
    </div>
  );
}
