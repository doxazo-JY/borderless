import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentGroup, getCurrentParticipantName } from "@/lib/group";

export async function POST(request: Request) {
  const group = await getCurrentGroup();
  if (!group) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const locationId =
    typeof body?.locationId === "string" ? body.locationId : null;
  const message =
    typeof body?.message === "string" ? body.message.trim() || null : null;
  const requesterName = await getCurrentParticipantName();

  await prisma.helpRequest.create({
    data: { groupId: group.id, locationId, message, requesterName },
  });

  return NextResponse.json({ ok: true });
}
