import { config, parse } from "dotenv";
import { existsSync, readFileSync } from "fs";

config();
if (existsSync(".env.local")) {
  const local = parse(readFileSync(".env.local"));
  for (const [key, value] of Object.entries(local)) {
    if (value !== "") process.env[key] = value;
  }
}

async function main() {
  const { PrismaClient } = await import("../src/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const adapter = new PrismaPg(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter });

  const location = await prisma.location.findFirst({
    where: { name: { contains: "테스트 포인트 (리허설" } },
  });
  if (!location) {
    console.log("리허설 테스트 포인트 없음 — 정리할 것 없음");
    await prisma.$disconnect();
    return;
  }

  const deletedSubs = await prisma.submission.deleteMany({
    where: { locationId: location.id },
  });
  const deletedHelp = await prisma.helpRequest.deleteMany({
    where: { locationId: location.id },
  });
  await prisma.location.delete({ where: { id: location.id } });

  console.log(
    `정리 완료: submission ${deletedSubs.count}건, helpRequest ${deletedHelp.count}건, location 1건 삭제`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
