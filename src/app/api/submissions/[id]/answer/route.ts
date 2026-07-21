import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentGroup } from "@/lib/group";

// 띄어쓰기/대소문자 차이로 오답 처리되지 않도록 정규화 후 비교
function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const group = await getCurrentGroup();
  if (!group) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { id } = await params;
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: { location: { include: { mission: true } } },
  });
  if (!submission || submission.groupId !== group.id) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const answer = typeof body?.answer === "string" ? body.answer.trim() : "";
  if (!answer) {
    return NextResponse.json(
      { ok: false, message: "정답을 입력해주세요." },
      { status: 400 },
    );
  }

  const acceptedAnswers = (submission.location.mission?.answer ?? "")
    .split(",")
    .map(normalize)
    .filter(Boolean);
  const correct = acceptedAnswers.includes(normalize(answer));

  await prisma.submission.update({
    where: { id: submission.id },
    data: { answerText: answer, answerCorrect: correct },
  });

  return NextResponse.json({ ok: true, correct });
}
