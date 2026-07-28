const NAVER_MAP_CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
const SCRIPT_ID = "naver-maps-sdk";

// 지도 화면(NaverMap.tsx)과 어드민 폼들은 서로 다른 페이지라 SDK가 아직 안
// 실려있을 수 있어, 지도가 필요한 시점에 지연 로드한다. 주소검색/좌표변환은
// 서버 API(/api/geocode, /api/reverse-geocode)로 옮겨서 이 스크립트는 지도
// 표시(Dynamic Map)만 담당한다.
export function loadNaverMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.naver?.maps) {
      resolve();
      return;
    }
    const existing = document.getElementById(
      SCRIPT_ID,
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Naver Maps SDK 로드 실패")),
      );
      return;
    }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${NAVER_MAP_CLIENT_ID}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Naver Maps SDK 로드 실패"));
    document.head.appendChild(script);
  });
}
