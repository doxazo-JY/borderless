import { NextResponse } from "next/server";
import { getCurrentGroup } from "@/lib/group";
import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";

// 사진 바이트도 영상과 마찬가지로 이 서버를 거치지 않고 브라우저 → Supabase Storage로
// 직접 업로드된다 (Vercel 서버리스 함수 요청 크기 제한에 걸리지 않도록 — 폰 카메라
// 사진은 쉽게 4.5MB를 넘는다). 이 라우트는 서명된 업로드 URL만 발급한다.
export async function POST(request: Request) {
  const group = await getCurrentGroup();
  if (!group) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const ext =
    typeof body?.ext === "string"
      ? body.ext.replace(/[^a-z0-9]/gi, "") || "jpg"
      : "jpg";
  const path = `submissions/${group.id}/${crypto.randomUUID()}.${ext}`;

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
