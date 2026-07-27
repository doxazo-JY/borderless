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

const MISSION_TYPES: MissionType[] = ["WORD", "PRAISE", "PRAYER", "CONFESSION"];
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
const CONFESSION_CONTENTS = [
  "'나는 ~입니다' 형식으로 나만의 신앙 고백 한 문장을 완성해 영상에 담아주세요.",
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
    { name: "라면사리" },
    { name: "쫄면사리" },
    { name: "납작당면" },
    { name: "우동사리" },
    { name: "치즈떡" },
    { name: "고구마떡" },
    { name: "쌀떡" },
    { name: "밀떡" },
    { name: "사각어묵" },
    { name: "꼬치어묵" },
    { name: "봉어묵" },
    { name: "모둠어묵" },
    { name: "모짜렐라(치즈)" },
    { name: "비엔나" },
    { name: "만두" },
    { name: "김말이" },
  ];
  const ingredients = await Promise.all(
    ingredientDefs.map((data) => prisma.ingredient.create({ data })),
  );

  function contentFor(type: MissionType, idx: number): string {
    if (type === "WORD") return WORD_CONTENTS[idx % WORD_CONTENTS.length];
    if (type === "PRAYER") return PRAYER_CONTENTS[idx % PRAYER_CONTENTS.length];
    if (type === "CONFESSION")
      return CONFESSION_CONTENTS[idx % CONFESSION_CONTENTS.length];
    return "";
  }

  let locationIndex = 0;
  for (const region of regions) {
    for (let i = 1; i <= 4; i++) {
      // 같은 포인트에 먼저/나중에 도착하는 두 조가 서로 다른 미션을 받도록
      // 슬롯마다 다른 타입을 배정한다 (round-robin으로 한 칸씩 밀어서).
      const mission1Type = MISSION_TYPES[locationIndex % MISSION_TYPES.length];
      const mission2Type =
        MISSION_TYPES[(locationIndex + 1) % MISSION_TYPES.length];

      const mission1 = await prisma.mission.create({
        data: { type: mission1Type, content: contentFor(mission1Type, locationIndex) },
      });
      const mission2 = await prisma.mission.create({
        data: { type: mission2Type, content: contentFor(mission2Type, locationIndex + 1) },
      });

      const ingredient = ingredients[locationIndex % ingredients.length];

      await prisma.location.create({
        data: {
          regionId: region.id,
          name: `${region.name}지역 ${i}번 포인트 (더미)`,
          lat: BASE_LAT + (locationIndex % 4) * 0.01,
          lng: BASE_LNG + Math.floor(locationIndex / 4) * 0.01,
          mission1Id: mission1.id,
          mission2Id: mission2.id,
          ingredients: { connect: [{ id: ingredient.id }] },
        },
      });
      locationIndex++;
    }
  }

  // 실제 지역 방문 순서 (임원 확정, 2026-07-27): 1조는 d->b->a->c, 2조는 c->a->b->d
  const regionIdByName = new Map(regions.map((r) => [r.name, r.id]));
  const ORDER_BY_GROUP_NUMBER: Record<number, string[]> = {
    1: ["d", "b", "a", "c"],
    2: ["c", "a", "b", "d"],
  };
  for (const group of groups) {
    const order = ORDER_BY_GROUP_NUMBER[group.groupNumber];
    for (let position = 0; position < order.length; position++) {
      await prisma.groupRegionOrder.create({
        data: {
          groupId: group.id,
          regionId: regionIdByName.get(order[position])!,
          position,
        },
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
