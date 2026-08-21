import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// 카톡 등에 링크 공유할 때 뜨는 미리보기 카드용 — 이게 없으니 카카오가 기본
// "Create Next App" 문구랑 페이지에서 아무 사진(기준 사진 등)이나 주워다
// 카드에 넣고 있었다. 명시적으로 하나 만들어서 그 문제를 없앤다.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f3ec",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
          }}
        >
          <div style={{ width: 48, height: 2, background: "#e4e0d5" }} />
          <div
            style={{
              fontSize: 96,
              fontWeight: 800,
              letterSpacing: 4,
              color: "#e1591c",
            }}
          >
            BORDERLESS
          </div>
          <div style={{ width: 48, height: 2, background: "#e4e0d5" }} />
        </div>
        <div style={{ marginTop: 28, fontSize: 32, color: "#1c211d" }}>
          청년부 수련회 미션 앱
        </div>
      </div>
    ),
    { ...size },
  );
}
