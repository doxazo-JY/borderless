import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentGroup } from "@/lib/group";
import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";

// 영상 바이트는 이 서버를 거치지 않고 브라우저 → Supabase Storage로 직접 업로드된다
// (Vercel 서버리스 함수의 요청 크기 제한에 영상이 걸리지 않도록). 이 라우트는
// 클라이언트가 직접 업로드할 수 있는 서명된 URL만 발급한다.
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
  const path = `videos/${group.id}/${submission.id}.${ext}`;

  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });

  if (error || !data) {
    return NextResponse.json(
      { ok: false, message: error?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    path: data.path,
    token: data.token,
    bucket: STORAGE_BUCKET,
  });
}
