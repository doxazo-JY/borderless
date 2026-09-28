import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Supabase 무료 플랜은 7일간 DB 요청이 없으면 프로젝트를 일시정지한다.
// vercel.json의 cron이 매일 한 번 이 엔드포인트를 호출해 가벼운 쿼리로 깨워둔다.
// Vercel Cron은 CRON_SECRET 환경변수가 있으면 Authorization: Bearer <값>을 자동으로 붙여 보낸다.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const team = await prisma.team.findFirst({ select: { id: true } });

  return NextResponse.json({ ok: true, found: team !== null, at: new Date().toISOString() });
}
