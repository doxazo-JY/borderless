import { PrismaClient } from "../src/generated/prisma/client";
import type { MissionType } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const REGION_NAMES = ["a", "b", "c", "d"] as const;
const TEAM_NAMES = ["A", "B", "C", "D"] as const;

// 인천 강화군 송해면 숙소 대략 좌표 기준 더미 오프셋 (실제 답사 전까지 임시값)
const BASE_LAT = 37.73;
const BASE_LNG = 126.43;

const MISSION_TYPES: MissionType[] = ["WORD", "PRAISE", "PRAYER"];
const WORD_CONTENTS = [
  "빌립보서 4:13 암송하기",
  "시편 23:1 묵상 후 나누기",
  "요한복음 3:16 암송하기",
  "로마서 8:28 묵상 후 나누기",
];
const PRAYER_CONTENTS = [
  "옆 조원과 손잡고 30초 침묵 기도",
  "이번 수련회 은혜를 위해 함께 기도",
  "가족을 위한 기도제목 나누고 기도",
  "다음 방문 지역 안전을 위해 기도",
];

async function main() {
  await prisma.helpRequest.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.groupRegionOrder.deleteMany();
  await prisma.location.deleteMany();
  await prisma.mission.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.group.deleteMany();
  await prisma.team.deleteMany();
  await prisma.region.deleteMany();

  const teams = await Promise.all(
    TEAM_NAMES.map((name) => prisma.team.create({ data: { name } })),
  );

  const groups = [];
  for (const team of teams) {
    for (const groupNumber of [1, 2]) {
      const group = await prisma.group.create({
        data: {
          teamId: team.id,
          groupNumber,
          displayName: `${team.name}팀 ${groupNumber}조`,
        },
      });
      groups.push(group);
    }
  }

  const regions = await Promise.all(
    REGION_NAMES.map((name) => prisma.region.create({ data: { name } })),
  );

  const ingredientDefs = [
    { name: "떡(일반떡)" },
    { name: "떡(치즈떡)" },
    { name: "대파" },
    { name: "고추장" },
    { name: "치즈" },
    { name: "김가루" },
  ];
  const ingredients = await Promise.all(
    ingredientDefs.map((data) => prisma.ingredient.create({ data })),
  );

  let locationIndex = 0;
  for (const region of regions) {
    for (let i = 1; i <= 4; i++) {
      const missionType = MISSION_TYPES[locationIndex % MISSION_TYPES.length];
      const content =
        missionType === "WORD"
          ? WORD_CONTENTS[locationIndex % WORD_CONTENTS.length]
          : missionType === "PRAYER"
            ? PRAYER_CONTENTS[locationIndex % PRAYER_CONTENTS.length]
            : "";

      const mission = await prisma.mission.create({
        data: { type: missionType, content },
      });

      const ingredient = ingredients[locationIndex % ingredients.length];

      await prisma.location.create({
        data: {
          regionId: region.id,
          name: `${region.name}지역 ${i}번 포인트 (더미)`,
          lat: BASE_LAT + (locationIndex % 4) * 0.01,
          lng: BASE_LNG + Math.floor(locationIndex / 4) * 0.01,
          missionId: mission.id,
          ingredients: { connect: [{ id: ingredient.id }] },
        },
      });
      locationIndex++;
    }
  }

  // 더미 지역 방문 순서: 전 그룹 a->b->c->d (실제 순서는 다른 임원 확정 후 admin에서 재배정)
  for (const group of groups) {
    for (let position = 0; position < regions.length; position++) {
      await prisma.groupRegionOrder.create({
        data: { groupId: group.id, regionId: regions[position].id, position },
      });
    }
  }

  console.log(
    `Seeded: ${teams.length} teams, ${groups.length} groups, ${regions.length} regions, ${locationIndex} locations, ${ingredients.length} ingredients`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
