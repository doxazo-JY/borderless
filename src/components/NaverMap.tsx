"use client";

import { useEffect, useRef, useState } from "react";
import { loadNaverMaps } from "@/lib/naver-loader";

export type MapLocation = {
  id: string;
  name: string;
  regionId: string;
  regionName: string;
  lat: number;
  lng: number;
  isPassed?: boolean; // 사진 판정 통과
  isMissionDone?: boolean; // 미션 완료(영상 업로드)까지 끝남
  isClosed?: boolean;
  // 지금 차례인 지역의 미시도 포인트이거나 본인이 통과한 포인트 — 그 외(아직 차례
  // 아닌 지역, 이미 다른 포인트에서 통과해버린 지역의 나머지 포인트)는 흐리게 표시
  isRelevant?: boolean;
};

declare global {
  interface Window {
    // Naver Maps SDK는 공식 타입 제공을 안 함
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    naver: any;
  }
}

const NAVER_MAP_CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
const COMPASS_PREFERENCE_KEY = "borderless-compass-enabled";
// 숙소(펜션) — 미션 포인트가 아니라 참가자가 위치를 가늠할 수 있게 항상 표시되는
// 참고용 마커. DB Location으로 넣지 않는다(지역당 4곳 카운팅 로직과 무관해야 함).
const PENSION_ADDRESS = "인천 강화군 송해면 오류내길99번길 40-7";
const PENSION_LABEL = "숙소";
// 지도 초기 줌 — Naver 줌은 숫자가 클수록 확대(Kakao level과 반대 방향)
const MAP_ZOOM = 14;

type LatLng = { lat: number; lng: number };

// 지역 경계선 — 그 지역 포인트들의 실제 좌표를 감싸는 다각형을 자동 계산해서
// 그린다(손으로 경계 좌표를 등록할 필요 없음). 점이 3개 미만이면 convex hull이
// 의미가 없어 그대로 반환한다(1개는 원으로, 2개는 선으로 별도 처리).
function convexHull(points: LatLng[]): LatLng[] {
  if (points.length < 3) return points;
  const sorted = [...points].sort((a, b) => a.lng - b.lng || a.lat - b.lat);
  const cross = (o: LatLng, a: LatLng, b: LatLng) =>
    (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng);
  const lower: LatLng[] = [];
  for (const p of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: LatLng[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

// 경계선이 마커 정중앙을 스치듯 지나가면 답답해 보여서, 무게중심 기준으로 각
// 꼭짓점을 살짝(약 35m) 바깥으로 밀어낸다.
function padHull(hull: LatLng[], paddingDeg = 0.00035): LatLng[] {
  if (hull.length === 0) return hull;
  const centroid = {
    lat: hull.reduce((s, p) => s + p.lat, 0) / hull.length,
    lng: hull.reduce((s, p) => s + p.lng, 0) / hull.length,
  };
  return hull.map((p) => {
    const dx = p.lng - centroid.lng;
    const dy = p.lat - centroid.lat;
    const dist = Math.hypot(dx, dy) || 1;
    return {
      lat: p.lat + (dy / dist) * paddingDeg,
      lng: p.lng + (dx / dist) * paddingDeg,
    };
  });
}

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

export function NaverMap({
  locations,
  onSelectLocation,
  selectedLocationId,
  onSelectPension,
  selectedPension,
  targetRegionId,
}: {
  locations: MapLocation[];
  onSelectLocation?: (locationId: string) => void;
  selectedLocationId?: string | null;
  onSelectPension?: () => void;
  selectedPension?: boolean;
  targetRegionId?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(() =>
    NAVER_MAP_CLIENT_ID ? "loading" : "error",
  );
  const [showLegend, setShowLegend] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [needsCompassPermission, setNeedsCompassPermission] = useState(false);
  const onSelectLocationRef = useRef(onSelectLocation);
  useEffect(() => {
    onSelectLocationRef.current = onSelectLocation;
  }, [onSelectLocation]);
  const onSelectPensionRef = useRef(onSelectPension);
  useEffect(() => {
    onSelectPensionRef.current = onSelectPension;
  }, [onSelectPension]);
  // 펜션 마커는 지오코딩이 끝나야 좌표를 알 수 있어(비동기), 클릭 판정용 좌표와
  // 선택 상태 스타일을 갱신할 DOM을 이 ref들에 담아둔다.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pensionPositionRef = useRef<any>(null);
  const pensionElRef = useRef<HTMLDivElement | null>(null);
  // 개발 모드 StrictMode가 effect를 두 번 실행해도 지도가 중복 생성되지 않도록 가드
  const mapCreatedRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // 통과/마감 상태가 바뀔 때마다 지도(및 마커) 전체를 새로 만들지 않고, 이미 만들어둔
  // 마커 DOM만 찾아서 색을 갱신하기 위한 위치별 참조
  const pinElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  // 선택된 마커를 시각적으로 맨 앞에 오게 하기 위한 마커 참조
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Map<string, any>>(new Map());
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
    if (!NAVER_MAP_CLIENT_ID) {
      console.error("NEXT_PUBLIC_NAVER_MAP_CLIENT_ID가 설정되지 않았습니다.");
      return;
    }

    let cancelled = false;

    function initMap() {
      if (cancelled) return;
      if (!containerRef.current) return;
      if (mapCreatedRef.current) return;
      mapCreatedRef.current = true;

      const naver = window.naver;
      const center =
        locations.length > 0
          ? new naver.maps.LatLng(locations[0].lat, locations[0].lng)
          : new naver.maps.LatLng(37.73, 126.43);

      const map = new naver.maps.Map(containerRef.current, {
        center,
        zoom: MAP_ZOOM,
      });
      mapInstanceRef.current = map;

      // 지역 경계선 — 같은 지역 포인트들을 감싸는 다각형을 좌표로부터 자동 계산해서
      // 그린다. 지금 차례인 지역만 강조하고 나머지는 옅게 표시하되(마커 흐림
      // 처리와 같은 규칙), 강조색은 액센트 오렌지 대신 마커의 "미시도" 기본색과
      // 같은 파랑을 쓴다 — 오렌지는 마커에서 이미 "판정 통과·완료 대기"란 뜻으로
      // 쓰이고 있어서, 지역 경계에 또 쓰면 상태 표시랑 헷갈릴 수 있다.
      const byRegion = new Map<string, LatLng[]>();
      for (const loc of locations) {
        const list = byRegion.get(loc.regionId) ?? [];
        list.push({ lat: loc.lat, lng: loc.lng });
        byRegion.set(loc.regionId, list);
      }
      for (const [regionId, points] of byRegion) {
        if (points.length === 0) continue;
        const isTarget = regionId === targetRegionId;
        const strokeColor = isTarget ? "#2563eb" : "#6b7280";
        const strokeWeight = isTarget ? 2.5 : 1.5;
        const strokeOpacity = isTarget ? 0.85 : 0.65;

        if (points.length === 1) {
          new naver.maps.Circle({
            map,
            center: new naver.maps.LatLng(points[0].lat, points[0].lng),
            radius: 35,
            strokeWeight,
            strokeColor,
            strokeOpacity,
            strokeStyle: "shortdash",
            fillOpacity: 0,
          });
          continue;
        }

        const hullPoints =
          points.length === 2 ? points : padHull(convexHull(points));
        const path = hullPoints.map(
          (p) => new naver.maps.LatLng(p.lat, p.lng),
        );
        if (points.length === 2) {
          new naver.maps.Polyline({
            map,
            path,
            strokeWeight: strokeWeight + 2,
            strokeColor,
            strokeOpacity,
            strokeStyle: "shortdash",
          });
        } else {
          new naver.maps.Polygon({
            map,
            paths: [path],
            strokeWeight,
            strokeColor,
            strokeOpacity,
            strokeStyle: "shortdash",
            fillColor: strokeColor,
            fillOpacity: isTarget ? 0.05 : 0.02,
          });
        }
      }

      // 마커는 시각적 표시용(HTML 아이콘)으로만 두고, 클릭 판정은 지도 자체의
      // click 이벤트(가장 기본적이고 안정적인 기능) + 좌표 거리 계산으로 직접 처리한다.
      // 개별 마커의 자체 클릭 판정은 카카오 지도에서 내부 드래그 판정과 얽혀 씹히는
      // 문제가 있어 신뢰할 수 없었던 방식을 그대로 이어받아, 네이버 전환 후에도
      // 동일한 방식을 유지한다(검증된 동작을 굳이 바꾸지 않음).
      const bounds =
        locations.length > 0
          ? new naver.maps.LatLngBounds(
              new naver.maps.LatLng(locations[0].lat, locations[0].lng),
              new naver.maps.LatLng(locations[0].lat, locations[0].lng),
            )
          : null;

      locations.forEach((loc) => {
        const position = new naver.maps.LatLng(loc.lat, loc.lng);
        bounds?.extend(position);

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

        const marker = new naver.maps.Marker({
          position,
          map,
          icon: {
            content: pinEl,
            size: new naver.maps.Size(24, 24),
            anchor: new naver.maps.Point(12, 12),
          },
          clickable: false,
          zIndex: 1,
        });
        markersRef.current.set(loc.id, marker);
      });

      const HIT_RADIUS_PX = 22;
      naver.maps.Event.addListener(map, "click", (e: { coord: unknown }) => {
        const proj = map.getProjection();
        const clickPoint = proj.fromCoordToOffset(e.coord);

        let closest: (typeof locations)[number] | null = null;
        let closestDist = Infinity;
        for (const loc of locations) {
          const locPoint = proj.fromCoordToOffset(
            new naver.maps.LatLng(loc.lat, loc.lng),
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

        // 펜션 마커도 같은 방식(좌표 거리)으로 클릭 판정 — 미션 포인트와 겹쳐
        // 있으면 더 가까운 쪽이 이긴다.
        let pensionDist = Infinity;
        if (pensionPositionRef.current) {
          const pensionPoint = proj.fromCoordToOffset(
            pensionPositionRef.current,
          );
          pensionDist = Math.hypot(
            clickPoint.x - pensionPoint.x,
            clickPoint.y - pensionPoint.y,
          );
        }

        if (pensionDist <= HIT_RADIUS_PX && pensionDist <= closestDist) {
          onSelectPensionRef.current?.();
        } else if (closest && closestDist <= HIT_RADIUS_PX) {
          onSelectLocationRef.current?.(closest.id);
        }
      });

      if (bounds) {
        map.fitBounds(bounds);
      }

      // 숙소(펜션) 마커 — 주소를 지오코딩해서 항상 표시되는 참고용 핀 하나만 추가.
      // 실패해도(네트워크 등) 지도 기능 자체엔 영향 없이 조용히 넘어간다. bounds는
      // 일부러 건드리지 않는다 — 리허설처럼 미션 포인트가 실제 숙소(강화도)와 멀리
      // 떨어진 곳에 있으면, 펜션까지 포함하려고 지도가 그 거리만큼 확 줌아웃돼서
      // 정작 미션 포인트들이 안 보이게 된다. 펜션 마커는 그 좌표에 얹혀만 있고,
      // 지도 화면 범위는 항상 미션 포인트 기준으로만 잡는다.
      fetch(`/api/geocode?query=${encodeURIComponent(PENSION_ADDRESS)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled || !data?.ok) return;
          const pensionLatLng = new naver.maps.LatLng(data.lat, data.lng);

          const pensionEl = document.createElement("div");
          Object.assign(pensionEl.style, {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "26px",
            height: "26px",
            borderRadius: "8px",
            border: "1.5px solid #1c211d",
            background: "#ffffff",
            boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
            color: "#1c211d",
            pointerEvents: "none",
          });
          pensionEl.title = PENSION_LABEL;
          pensionEl.innerHTML =
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></svg>';

          new naver.maps.Marker({
            position: pensionLatLng,
            map,
            icon: {
              content: pensionEl,
              size: new naver.maps.Size(26, 26),
              anchor: new naver.maps.Point(13, 13),
            },
            clickable: false,
            zIndex: 2,
          });

          // 클릭 판정(좌표 거리 계산)과 선택 스타일 갱신(아래 별도 effect)에
          // 쓸 수 있게 저장해둔다.
          pensionPositionRef.current = pensionLatLng;
          pensionElRef.current = pensionEl;
        })
        .catch(() => {});

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            if (cancelled) return;
            const myLatLng = new naver.maps.LatLng(
              position.coords.latitude,
              position.coords.longitude,
            );

            // 실제 축척(반경 15m)으로 그리면 지도 줌 레벨에서 거의 안 보여서,
            // 마커처럼 고정 픽셀 크기의 아이콘으로 표시한다. 미션 포인트 핀(파란색)과
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

            new naver.maps.Marker({
              position: myLatLng,
              map,
              icon: {
                content: wrapperEl,
                size: new naver.maps.Size(46, 46),
                anchor: new naver.maps.Point(23, 23),
              },
              clickable: false,
              zIndex: 5,
            });

            if (bounds) {
              bounds.extend(myLatLng);
              map.fitBounds(bounds);
            }

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
    }

    loadNaverMaps()
      .then(initMap)
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [locations]);

  // 마커 생성 자체는 최초 1회뿐이라(위 effect의 mapCreatedRef 가드), 통과/마감 상태나
  // 선택 여부가 바뀌었을 때 지도를 통째로 다시 만들지 않고 이미 그려둔 마커 DOM만
  // 갱신한다 — 그래야 미션 통과 직후 지도를 새로고침하지 않아도 마커 색이 바로 바뀐다.
  useEffect(() => {
    for (const loc of locations) {
      const isSelected = loc.id === selectedLocationId;
      const pinEl = pinElsRef.current.get(loc.id);
      if (pinEl) applyPinStatus(pinEl, loc, isSelected);
      markersRef.current.get(loc.id)?.setZIndex(isSelected ? 100 : 1);
    }
  }, [locations, selectedLocationId]);

  useEffect(() => {
    const pensionEl = pensionElRef.current;
    if (!pensionEl) return;
    if (selectedPension) {
      pensionEl.style.borderColor = "#e1591c";
      pensionEl.style.boxShadow = "0 0 0 2px #e1591c";
    } else {
      pensionEl.style.borderColor = "#1c211d";
      pensionEl.style.boxShadow = "0 1px 4px rgba(0,0,0,0.35)";
    }
  }, [selectedPension]);

  // 네이버 지도는 컨테이너 크기가 바뀌어도(예: PC 화면에서 옆에 패널이 열리고 닫히며
  // 지도 폭이 변할 때) 스스로 다시 그리지 않아 빈 회색 영역이 생긴다 —
  // ResizeObserver로 감지해서 autoResize()를 호출해준다.
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      mapInstanceRef.current?.autoResize();
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
          지도를 불러오지 못했습니다. Naver Maps 키/도메인 등록을 확인해주세요.
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
