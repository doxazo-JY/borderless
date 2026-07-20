const KAKAO_APP_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
const SCRIPT_ID = "kakao-maps-sdk-services";

// 어드민 폼들은 지도 화면(KakaoMap.tsx)과 별개 페이지라 SDK가 아직 안 실려있을 수 있어,
// 지오코딩/좌표 선택 등이 필요한 시점에 services 라이브러리를 지연 로드한다.
export function loadKakaoServices(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.kakao?.maps?.services) {
      resolve();
      return;
    }
    const existing = document.getElementById(
      SCRIPT_ID,
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () =>
        window.kakao.maps.load(() => resolve()),
      );
      return;
    }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}&autoload=false&libraries=services`;
    script.async = true;
    script.onload = () => window.kakao.maps.load(() => resolve());
    script.onerror = () => reject(new Error("Kakao SDK 로드 실패"));
    document.head.appendChild(script);
  });
}
