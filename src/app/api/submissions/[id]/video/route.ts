import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentGroup } from "@/lib/group";
import { createR2UploadUrl } from "@/lib/r2";

// 영상 바이트는 이 서버를 거치지 않고 브라우저 → Cloudflare R2로 직접 업로드된다
// (Vercel 서버리스 함수의 요청 크기 제한에 영상이 걸리지 않도록). 이 라우트는
// 클라이언트가 직접 업로드할 수 있는 서명된 PUT URL만 발급한다.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const group = await getCurrentGroup();
  if (!group) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { id } = await params;
  const submission = await prisma.submission.findUnique({ where: { id } });
  if (!submission || submission.groupId !== group.id) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const ext = typeof body?.ext === "string" ? body.ext.replace(/[^a-z0-9]/gi, "") || "mp4" : "mp4";
  const contentType = typeof body?.contentType === "string" ? body.contentType : undefined;
  const path = `videos/${group.id}/${submission.id}.${ext}`;

  try {
    const uploadUrl = await createR2UploadUrl(path, contentType);
    return NextResponse.json({ ok: true, path, uploadUrl });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
