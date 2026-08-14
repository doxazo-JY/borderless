import { NextResponse, after } from "next/server";
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

  // 알림은 응답 이후 보조적으로 시도 — await 없이 그냥 호출만 하면 Vercel이
  // 응답을 보내자마자 함수 실행을 바로 얼려버려서(freeze) fetch가 끝까지 못
  // 가고 씹히는 문제가 있었다. after()로 감싸면 응답은 그대로 즉시 나가면서도
  // 이 콜백이 끝날 때까지 함수가 살아있게 Vercel이 보장해준다.
  const where = location ? `${location.region.name}지역 · ${location.name}` : "장소 미지정";
  console.log("[help-requests] scheduling ntfy notification, topic set:", !!process.env.NTFY_TOPIC);
  after(async () => {
    console.log("[help-requests] after() callback started");
    await sendNtfyNotification(
      `도움 요청 — ${group.displayName}${requesterName ? ` (${requesterName})` : ""}`,
      `${where}${message ? `\n"${message}"` : ""}`,
    );
    console.log("[help-requests] after() callback finished");
  });

  return NextResponse.json({ ok: true });
}
