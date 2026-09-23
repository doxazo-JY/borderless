import { NextResponse } from "next/server";
import { getCurrentGroup } from "@/lib/group";
import { createR2UploadUrl } from "@/lib/r2";

// 사진 바이트도 영상과 마찬가지로 이 서버를 거치지 않고 브라우저 → R2로 직접
// 업로드된다 (Vercel 서버리스 함수 요청 크기 제한에 걸리지 않도록 — 폰 카메라
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
  const contentType =
    typeof body?.contentType === "string" ? body.contentType : undefined;
  const path = `submissions/${group.id}/${crypto.randomUUID()}.${ext}`;

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
