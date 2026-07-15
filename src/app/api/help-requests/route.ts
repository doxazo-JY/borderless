import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentGroup } from "@/lib/group";

export async function POST(request: Request) {
  const group = await getCurrentGroup();
  if (!group) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const locationId =
    typeof body?.locationId === "string" ? body.locationId : null;

  await prisma.helpRequest.create({
    data: { groupId: group.id, locationId },
  });

  return NextResponse.json({ ok: true });
}
