import { NextResponse } from "next/server";
import { createR2UploadUrl } from "@/lib/r2";

// 갤러리 완성 영상 교체용. 다른 업로드들과 같은 이유로 서버는 영상 바이트를
// 거치지 않고, 브라우저가 이 서명된 PUT URL로 Cloudflare R2에 직접 올린다.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const ext =
    typeof body?.ext === "string"
      ? body.ext.replace(/[^a-z0-9]/gi, "") || "mp4"
      : "mp4";
  const contentType =
    typeof body?.contentType === "string" ? body.contentType : undefined;
  const path = `videos/admin-replace/${crypto.randomUUID()}.${ext}`;

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
