// 영상에 이어 사진(기준 사진/미션 이미지/제출 사진)도 R2로 옮긴다 —
// 2026-09-23, Supabase 조직이 File storage 할당량을 초과해서(다른 프로젝트
// Somebasil과 같은 조직을 공유) 9/28부터 제한이 걸리는 상황. Supabase
// Storage를 완전히 비우고 DB만 남기기 위한 마이그레이션.
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

async function migrateOne(
  url: string,
  destPathPrefix: string,
): Promise<string | null> {
  if (url.startsWith(R2_PUBLIC_URL)) return null; // 이미 이관됨

  const res = await fetch(url);
  if (!res.ok) throw new Error(`다운로드 실패 (${res.status})`);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());

  const ext = url.split(".").pop()?.split("?")[0] || "jpg";
  const path = `${destPathPrefix}/${crypto.randomUUID()}.${ext}`;

  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: path,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  return `${R2_PUBLIC_URL}/${path}`;
}

async function main() {
  const { PrismaClient } = await import("../src/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const adapter = new PrismaPg(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter });

  try {
    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    const locations = await prisma.location.findMany({
      where: { referencePhotoUrl: { not: null } },
      select: { id: true, referencePhotoUrl: true },
    });
    console.log(`Location.referencePhotoUrl ${locations.length}건`);
    for (const loc of locations) {
      try {
        const newUrl = await migrateOne(loc.referencePhotoUrl!, "reference");
        if (!newUrl) { skipped++; continue; }
        await prisma.location.update({ where: { id: loc.id }, data: { referencePhotoUrl: newUrl } });
        migrated++;
        console.log(`✓ location ${loc.id}`);
      } catch (e) {
        failed++;
        console.error(`✗ location ${loc.id}:`, e instanceof Error ? e.message : e);
      }
    }

    const missions = await prisma.mission.findMany({
      where: { imageUrl: { not: null } },
      select: { id: true, imageUrl: true },
    });
    console.log(`Mission.imageUrl ${missions.length}건`);
    for (const m of missions) {
      try {
        const newUrl = await migrateOne(m.imageUrl!, "mission");
        if (!newUrl) { skipped++; continue; }
        await prisma.mission.update({ where: { id: m.id }, data: { imageUrl: newUrl } });
        migrated++;
        console.log(`✓ mission ${m.id}`);
      } catch (e) {
        failed++;
        console.error(`✗ mission ${m.id}:`, e instanceof Error ? e.message : e);
      }
    }

    const submissions = await prisma.submission.findMany({
      where: { photoUrl: { not: null } },
      select: { id: true, photoUrl: true, groupId: true },
    });
    console.log(`Submission.photoUrl ${submissions.length}건`);
    for (const s of submissions) {
      try {
        const newUrl = await migrateOne(s.photoUrl!, `submissions/${s.groupId}`);
        if (!newUrl) { skipped++; continue; }
        await prisma.submission.update({ where: { id: s.id }, data: { photoUrl: newUrl } });
        migrated++;
        console.log(`✓ submission ${s.id}`);
      } catch (e) {
        failed++;
        console.error(`✗ submission ${s.id}:`, e instanceof Error ? e.message : e);
      }
    }

    console.log(`\n완료 — 이관 ${migrated}건, 이미 이관됨 ${skipped}건, 실패 ${failed}건`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
