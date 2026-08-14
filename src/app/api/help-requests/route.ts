import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentGroup } from "@/lib/group";
import { sendNtfyNotification } from "@/lib/ntfy";

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
  const requesterName =
    [group.memberName1, group.memberName2].filter(Boolean).join(" · ") ||
    null;

  const location = locationId
    ? await prisma.location.findUnique({
        where: { id: locationId },
        include: { region: true },
      })
    : null;

  await prisma.helpRequest.create({
    data: { groupId: group.id, locationId, message, requesterName },
  });

  // 알림은 도움 요청 저장이 끝난 뒤 보조적으로만 시도 — 실패해도(await 안 함)
  // 참가자 쪽 요청 응답이 늦어지거나 실패하지 않는다.
  const where = location ? `${location.region.name}지역 · ${location.name}` : "장소 미지정";
  sendNtfyNotification(
    `도움 요청 — ${group.displayName}${requesterName ? ` (${requesterName})` : ""}`,
    `${where}${message ? `\n"${message}"` : ""}`,
  );

  return NextResponse.json({ ok: true });
}
