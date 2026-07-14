import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [teams, groups, regions, locations] = await Promise.all([
    prisma.team.count(),
    prisma.group.count(),
    prisma.region.count(),
    prisma.location.count(),
  ]);

  return NextResponse.json({ ok: true, teams, groups, regions, locations });
}
