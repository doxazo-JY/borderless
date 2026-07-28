import { NextResponse } from "next/server";

const CLIENT_ID = process.env.NAVER_MAP_CLIENT_ID;
const CLIENT_SECRET = process.env.NAVER_MAP_CLIENT_SECRET;

type ReverseGeocodeResult = {
  name: "roadaddr" | "addr";
  region: {
    area1?: { name: string };
    area2?: { name: string };
    area3?: { name: string };
    area4?: { name: string };
  };
  land?: {
    name?: string;
    number1?: string;
    number2?: string;
  };
};

function formatAddress(result: ReverseGeocodeResult): string {
  const { region, land } = result;
  const areas = [region.area1, region.area2, region.area3, region.area4]
    .map((a) => a?.name)
    .filter(Boolean);
  const parts = [...areas];
  if (land?.name) parts.push(land.name);
  if (land?.number1) {
    parts.push(land.number2 ? `${land.number1}-${land.number2}` : land.number1);
  }
  return parts.join(" ");
}

// 좌표 -> 주소. Geocode 라우트와 마찬가지로 Client Secret이 필요해 서버에서만
// 호출 가능하다.
export async function GET(request: Request) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const res = await fetch(
    `https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${lng},${lat}&output=json&orders=roadaddr,addr`,
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
  const results: ReverseGeocodeResult[] = data?.results ?? [];
  const best =
    results.find((r) => r.name === "roadaddr") ??
    results.find((r) => r.name === "addr");
  if (!best) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  return NextResponse.json({ ok: true, address: formatAddress(best) });
}
