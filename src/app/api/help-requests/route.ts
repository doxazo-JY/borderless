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

  const helpRequest = await prisma.helpRequest.create({
    data: { groupId: group.id, locationId, message, requesterName },
  });

  // 알림은 응답 이후 보조적으로 시도 — await 없이 그냥 호출만 하면 Vercel이
  // 응답을 보내자마자 함수 실행을 바로 얼려버려서(freeze) fetch가 끝까지 못
  // 가고 씹히는 문제가 있었다. after()로 감싸면 응답은 그대로 즉시 나가면서도
  // 이 콜백이 끝날 때까지 함수가 살아있게 Vercel이 보장해준다.
  const where = location ? `${location.region.name}지역 · ${location.name}` : "장소 미지정";
  after(() =>
    sendNtfyNotification(
      `도움 요청 — ${group.displayName}${requesterName ? ` (${requesterName})` : ""}`,
      `${where}${message ? `\n"${message}"` : ""}`,
    ),
  );

  // 참가자 쪽에서 이 id로 확인/해결 여부를 폴링해서 "요청이 갔는지/처리
  // 중인지" 계속 보여줄 수 있게 id를 같이 내려준다.
  return NextResponse.json({ ok: true, id: helpRequest.id });
}

// 참가자가 방금 보낸 자기 요청의 확인/해결 여부만 가볍게 폴링하는 용도.
// group 쿠키로 소유권 확인 — 다른 조 요청 상태는 못 보게.
export async function GET(request: Request) {
  const group = await getCurrentGroup();
  if (!group) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const helpRequest = await prisma.helpRequest.findUnique({
    where: { id },
    select: { groupId: true, status: true, acknowledgedAt: true },
  });
  if (!helpRequest || helpRequest.groupId !== group.id) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    status: helpRequest.status,
    acknowledged: !!helpRequest.acknowledgedAt,
  });
}
