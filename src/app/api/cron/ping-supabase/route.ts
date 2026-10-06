import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Supabase 무료 플랜은 7일간 활동이 없으면 프로젝트를 일시정지한다.
// vercel.json의 cron이 매일 한 번 이 엔드포인트를 호출해 깨워둔다.
// Vercel Cron은 CRON_SECRET 환경변수가 있으면 Authorization: Bearer <값>을 자동으로 붙여 보낸다.
//
// Prisma 쿼리(풀러 직결)만으로는 활동으로 안 잡혀 pause 예고 메일이 왔다(2026-10-05).
// 사진/영상을 R2로 옮긴 뒤로 앱이 *.supabase.co API를 전혀 안 거치기 때문으로 보여,
// REST API(PostgREST)로도 한 줄 조회한다.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const team = await prisma.team.findFirst({ select: { id: true } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();
  if (!url || !key) {
    return NextResponse.json({ ok: false, error: "missing supabase env" }, { status: 500 });
  }
  const res = await fetch(`${url}/rest/v1/Team?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });

  return NextResponse.json(
    { ok: res.ok, prisma: team !== null, rest: res.status, at: new Date().toISOString() },
    { status: res.ok ? 200 : 502 },
  );
}
