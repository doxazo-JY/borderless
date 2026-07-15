import { prisma } from "@/lib/prisma";
import { LocationForm } from "@/components/admin/LocationForm";
import {
  createIngredient,
  createMission,
  deleteIngredient,
  deleteLocation,
  deleteMission,
  setGroupRegionOrder,
} from "./actions";

const MISSION_LABEL: Record<string, string> = {
  WORD: "말씀",
  PRAISE: "찬양",
  PRAYER: "기도",
};

export default async function AdminSetupPage() {
  const [regions, locations, missions, ingredients, teams] = await Promise.all(
    [
      prisma.region.findMany({ orderBy: { name: "asc" } }),
      prisma.location.findMany({
        include: { region: true, mission: true, ingredients: true },
        orderBy: [{ region: { name: "asc" } }, { name: "asc" }],
      }),
      prisma.mission.findMany(),
      prisma.ingredient.findMany(),
      prisma.team.findMany({
        orderBy: { name: "asc" },
        include: {
          groups: {
            orderBy: { groupNumber: "asc" },
            include: {
              regionOrder: { orderBy: { position: "asc" }, include: { region: true } },
            },
          },
        },
      }),
    ],
  );

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-4">
      <h1 className="text-xl font-bold">어드민 설정</h1>

      {/* 지역 (읽기 전용) */}
      <section>
        <h2 className="mb-2 text-sm font-bold text-zinc-500">지역</h2>
        <p className="text-sm">{regions.map((r) => r.name).join(", ")}</p>
      </section>

      {/* 팀/조 (읽기 전용) */}
      <section>
        <h2 className="mb-2 text-sm font-bold text-zinc-500">팀 / 조</h2>
        <ul className="space-y-1 text-sm">
          {teams.flatMap((t) =>
            t.groups.map((g) => <li key={g.id}>{g.displayName}</li>),
          )}
        </ul>
      </section>

      {/* 그룹별 지역 방문 순서 */}
      <section>
        <h2 className="mb-2 text-sm font-bold text-zinc-500">
          그룹별 지역 방문 순서 (강제)
        </h2>
        <div className="space-y-3">
          {teams.flatMap((t) =>
            t.groups.map((g) => (
              <form
                key={g.id}
                action={setGroupRegionOrder}
                className="flex items-center gap-2 rounded border border-zinc-200 p-2"
              >
                <input type="hidden" name="groupId" value={g.id} />
                <span className="w-20 shrink-0 text-sm font-medium">
                  {g.displayName}
                </span>
                {[0, 1, 2, 3].map((position) => (
                  <select
                    key={position}
                    name="regionOrder"
                    defaultValue={g.regionOrder[position]?.regionId ?? ""}
                    className="rounded border border-zinc-300 p-1 text-xs"
                  >
                    <option value="">-</option>
                    {regions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                ))}
                <button
                  type="submit"
                  className="ml-auto rounded bg-zinc-900 px-2 py-1 text-xs text-white"
                >
                  저장
                </button>
              </form>
            )),
          )}
        </div>
      </section>

      {/* 미션 */}
      <section>
        <h2 className="mb-2 text-sm font-bold text-zinc-500">미션</h2>
        <ul className="mb-3 space-y-1">
          {missions.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded border border-zinc-200 p-2 text-sm"
            >
              <span>
                <span className="font-medium">
                  {MISSION_LABEL[m.type] ?? m.type}
                </span>{" "}
                — {m.content || "(자유곡)"}
              </span>
              <form action={deleteMission}>
                <input type="hidden" name="id" value={m.id} />
                <button className="text-xs text-red-500 underline">삭제</button>
              </form>
            </li>
          ))}
        </ul>
        <form
          action={createMission}
          className="flex gap-2 rounded border border-zinc-200 p-3"
        >
          <select name="type" className="rounded border border-zinc-300 p-2 text-sm">
            <option value="WORD">말씀</option>
            <option value="PRAISE">찬양</option>
            <option value="PRAYER">기도</option>
          </select>
          <input
            name="content"
            placeholder="본문/기도 주제 (찬양은 비워둬도 됨)"
            className="flex-1 rounded border border-zinc-300 p-2 text-sm"
          />
          <button className="rounded bg-zinc-900 px-3 py-2 text-sm text-white">
            추가
          </button>
        </form>
      </section>

      {/* 재료 */}
      <section>
        <h2 className="mb-2 text-sm font-bold text-zinc-500">재료</h2>
        <ul className="mb-3 space-y-1">
          {ingredients.map((ing) => (
            <li
              key={ing.id}
              className="flex items-center justify-between rounded border border-zinc-200 p-2 text-sm"
            >
              <span>
                {ing.name}
                {ing.variant ? ` (${ing.variant})` : ""} · {ing.category}
                {ing.isBase ? " · 기본재료" : ""}
              </span>
              <form action={deleteIngredient}>
                <input type="hidden" name="id" value={ing.id} />
                <button className="text-xs text-red-500 underline">삭제</button>
              </form>
            </li>
          ))}
        </ul>
        <form
          action={createIngredient}
          className="flex flex-wrap items-center gap-2 rounded border border-zinc-200 p-3"
        >
          <input
            name="name"
            placeholder="이름"
            required
            className="rounded border border-zinc-300 p-2 text-sm"
          />
          <input
            name="category"
            placeholder="분류(주재료/채소/양념 등)"
            required
            className="rounded border border-zinc-300 p-2 text-sm"
          />
          <input
            name="variant"
            placeholder="변형(선택, 예: 치즈떡)"
            className="rounded border border-zinc-300 p-2 text-sm"
          />
          <label className="flex items-center gap-1 text-xs">
            <input type="checkbox" name="isBase" /> 기본재료
          </label>
          <button className="rounded bg-zinc-900 px-3 py-2 text-sm text-white">
            추가
          </button>
        </form>
      </section>

      {/* 포인트 */}
      <section>
        <h2 className="mb-2 text-sm font-bold text-zinc-500">
          방문포인트 ({locations.length}개)
        </h2>
        <ul className="mb-3 space-y-2">
          {locations.map((loc) => (
            <li
              key={loc.id}
              className="flex items-start justify-between rounded border border-zinc-200 p-2 text-sm"
            >
              <div>
                <p className="font-medium">
                  {loc.region.name}지역 · {loc.name}
                </p>
                <p className="text-xs text-zinc-500">
                  {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)} · 캡{" "}
                  {loc.claimedCount}/{loc.capacity} ·{" "}
                  {loc.mission ? MISSION_LABEL[loc.mission.type] : "미션 없음"} ·{" "}
                  {loc.referencePhotoUrl ? "기준사진 있음" : "기준사진 없음"}
                </p>
              </div>
              <form action={deleteLocation}>
                <input type="hidden" name="id" value={loc.id} />
                <button className="text-xs text-red-500 underline">삭제</button>
              </form>
            </li>
          ))}
        </ul>

        <LocationForm
          regions={regions.map((r) => ({ id: r.id, label: r.name }))}
          missions={missions.map((m) => ({
            id: m.id,
            label: `${MISSION_LABEL[m.type] ?? m.type} — ${m.content || "(자유곡)"}`,
          }))}
          ingredients={ingredients.map((ing) => ({
            id: ing.id,
            label: `${ing.name}${ing.variant ? `(${ing.variant})` : ""}`,
          }))}
        />
      </section>
    </main>
  );
}
