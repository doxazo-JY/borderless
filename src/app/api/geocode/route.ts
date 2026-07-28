import { NextResponse } from "next/server";

const CLIENT_ID = process.env.NAVER_MAP_CLIENT_ID;
const CLIENT_SECRET = process.env.NAVER_MAP_CLIENT_SECRET;

// 주소 -> 좌표. Naver Geocoding API는 Client Secret이 필요해 브라우저에서 직접
// 호출할 수 없다(어드민 폼이 예전엔 카카오 SDK로 클라이언트에서 바로 호출했던
// 부분을 서버로 옮긴 것) — 어드민 폼에서 fetch로 이 라우트를 호출한다.
export async function GET(request: Request) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const query = new URL(request.url).searchParams.get("query")?.trim();
  if (!query) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const res = await fetch(
    `https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(query)}`,
    {
      headers: {
        Accept: "application/json",
        "x-ncp-apigw-api-key-id": CLIENT_ID,
        "x-ncp-apigw-api-key": CLIENT_SECRET,
      },
    },
  );

  if (!res.ok) {
    return NextResponse.json({ ok: false }, { status: 502 });
  }

  const data = await res.json();
  const first = data?.addresses?.[0];
  if (!first) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    lat: Number(first.y),
    lng: Number(first.x),
  });
}
