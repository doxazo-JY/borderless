import { NextResponse } from "next/server";
import { createR2UploadUrl } from "@/lib/r2";

// 기준 사진도 참가자 제출 사진과 같은 이유로 서버(Server Action)를 거치지 않고
// 브라우저 → R2로 직접 업로드한다 — Vercel은 Next.js의 serverActions.bodySizeLimit
// 설정과 무관하게 요청 본문을 4.5MB로 제한하는데, 폰카메라로 방금 찍은 사진은 이
// 한도를 쉽게 넘는다. 이 라우트는 서명된 업로드 URL만 발급한다.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const ext =
    typeof body?.ext === "string"
      ? body.ext.replace(/[^a-z0-9]/gi, "") || "jpg"
      : "jpg";
  const contentType =
    typeof body?.contentType === "string" ? body.contentType : undefined;
  // 방문포인트 기준 사진("reference")과 미션 이미지("mission") 둘 다 이 라우트를
  // 같이 쓴다 — Storage 안에서 용도별로만 폴더를 나누려는 목적, 권한 차이는 없음.
  const prefix =
    typeof body?.prefix === "string" && /^[a-z]+$/.test(body.prefix)
      ? body.prefix
      : "reference";
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;

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
