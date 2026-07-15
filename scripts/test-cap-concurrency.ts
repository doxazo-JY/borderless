import { config, parse } from "dotenv";
import { existsSync, readFileSync } from "fs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

config();
if (existsSync(".env.local")) {
  const local = parse(readFileSync(".env.local"));
  for (const [key, value] of Object.entries(local)) {
    if (value !== "") process.env[key] = value;
  }
}

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const CONCURRENT_REQUESTS = 8;

async function main() {
  const location = await prisma.location.findFirst({
    where: { claimedCount: 0 },
  });
  if (!location) throw new Error("claimedCount=0인 테스트용 location이 없음");

  console.log(
    `테스트 대상: ${location.name} (capacity=${location.capacity}), 동시 요청 ${CONCURRENT_REQUESTS}개 발사`,
  );

  const results = await Promise.all(
    Array.from({ length: CONCURRENT_REQUESTS }, () =>
      prisma.location.updateMany({
        where: { id: location.id, claimedCount: { lt: location.capacity } },
        data: { claimedCount: { increment: 1 } },
      }),
    ),
  );

  const successCount = results.filter((r) => r.count === 1).length;
  const final = await prisma.location.findUnique({ where: { id: location.id } });

  console.log(`성공(count=1)한 요청 수: ${successCount}`);
  console.log(`최종 claimedCount: ${final?.claimedCount} (capacity: ${location.capacity})`);

  if (successCount === location.capacity && final?.claimedCount === location.capacity) {
    console.log("✅ 통과: 정확히 capacity만큼만 증가함 (오버부킹 없음)");
  } else {
    console.log("❌ 실패: 예상과 다름 — 오버부킹 또는 언더부킹 발생");
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
