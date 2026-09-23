// Supabase 구독을 해지해도 갤러리 영상은 계속 살아있어야 해서(2026-09-23),
// 지금까지 Supabase Storage에 올라간 완성 영상들을 Cloudflare R2로 복사하고
// Submission.videoUrl을 새 R2 공개 URL로 갱신한다. 사진(기준 사진/미션
// 이미지/제출 사진)은 옮기지 않고 그대로 Supabase에 둔다.
import { config, parse } from "dotenv";
import { existsSync, readFileSync } from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

config();
if (existsSync(".env.local")) {
  const local = parse(readFileSync(".env.local"));
  for (const [key, value] of Object.entries(local)) {
    if (value !== "") process.env[key] = value;
  }
}

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});
const R2_BUCKET = process.env.R2_BUCKET_NAME || "borderless";
const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

async function main() {
  const { PrismaClient } = await import("../src/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const adapter = new PrismaPg(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter });

  try {
    await migrateAll(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

async function migrateAll(prisma: import("../src/generated/prisma/client").PrismaClient) {
  const submissions = await prisma.submission.findMany({
    where: { videoUrl: { not: null } },
    select: { id: true, videoUrl: true, groupId: true },
  });

  console.log(`videoUrl이 있는 제출 ${submissions.length}건 확인`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const submission of submissions) {
    const videoUrl = submission.videoUrl!;

    // 이미 R2로 옮겨진 것(재실행 대비)은 건너뜀
    if (videoUrl.startsWith(R2_PUBLIC_URL)) {
      skipped++;
      continue;
    }

    try {
      const res = await fetch(videoUrl);
      if (!res.ok) {
        throw new Error(`다운로드 실패 (${res.status})`);
      }
      const contentType = res.headers.get("content-type") || "video/mp4";
      const buffer = Buffer.from(await res.arrayBuffer());

      const ext = videoUrl.split(".").pop()?.split("?")[0] || "mp4";
      const path = `videos/${submission.groupId}/${submission.id}.${ext}`;

      await r2.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: path,
          Body: buffer,
          ContentType: contentType,
        }),
      );

      const newUrl = `${R2_PUBLIC_URL}/${path}`;
      await prisma.submission.update({
        where: { id: submission.id },
        data: { videoUrl: newUrl },
      });

      migrated++;
      console.log(`✓ ${submission.id} (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
    } catch (error) {
      failed++;
      console.error(`✗ ${submission.id} 실패:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`\n완료 — 이관 ${migrated}건, 이미 이관됨 ${skipped}건, 실패 ${failed}건`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
