import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Supabase 구독을 해지해도 갤러리 영상은 계속 살아있어야 해서(2026-09-23),
// 영상만 Cloudflare R2로 옮겼다 — 트래픽(egress) 요금이 없어 공유 링크
// 조회량에 상관없고, 프로젝트 pause 같은 Supabase 쪽 사정과 무관하다.
// 사진(기준 사진/미션 이미지/제출 사진)은 그대로 Supabase Storage에 둔다.
export const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const R2_BUCKET = process.env.R2_BUCKET_NAME || "borderless";

export function r2PublicUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${path}`;
}

// 브라우저가 이 URL로 바로 PUT 업로드하고, 우리 서버는 영상 바이트를 거치지
// 않는다(Vercel 서버리스 함수 요청 크기 제한 때문 — 사진 업로드 때와 같은 이유).
export function createR2UploadUrl(path: string, contentType?: string) {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: path,
    ...(contentType ? { ContentType: contentType } : {}),
  });
  return getSignedUrl(r2, command, { expiresIn: 60 * 10 });
}
