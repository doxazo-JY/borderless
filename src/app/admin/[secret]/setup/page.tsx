import { prisma } from "@/lib/prisma";
import { LocationForm } from "@/components/admin/LocationForm";
import { LocationPhotoUpload } from "@/components/admin/LocationPhotoUpload";
import { LocationDetailsEditor } from "@/components/admin/LocationDetailsEditor";
import { MissionEditor } from "@/components/admin/MissionEditor";
import { MissionPhotoUpload } from "@/components/admin/MissionPhotoUpload";
import { IngredientEditor } from "@/components/admin/IngredientEditor";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import {
  createIngredient,
  createMission,
  deleteIngredient,
  deleteLocation,
  deleteMission,
  toggleLocationActive,
} from "./actions";

const MISSION_LABEL: Record<string, string> = {
  WORD: "말씀",
  PRAISE: "찬양",
  PRAYER: "기도",
  CONFESSION: "고백",
};
const MISSION_TYPE_ORDER = ["WORD", "PRAISE", "PRAYER", "CONFESSION"];

// 문자열 그대로 비교하면 "1-24"가 "121-144"보다 뒤로 밀리는 등 숫자가 포함된
// 미션 문구(예: 시편 절 구간)가 크기 순이 아니라 글자 순으로 정렬된다 — 문구에
// 담긴 숫자 부분만 실제 크기로 비교하는 natural sort로 바로잡는다.
function naturalCompare(a: string, b: string): number {
  const chunks = (s: string) => s.match(/\d+|\D+/g) ?? [];
  const ca = chunks(a);
  const cb = chunks(b);
  const len = Math.max(ca.length, cb.length);
  for (let i = 0; i < len; i++) {
    const x = ca[i] ?? "";
    const y = cb[i] ?? "";
    if (x === y) continue;
    if (/^\d+$/.test(x) && /^\d+$/.test(y)) {
      const diff = Number(x) - Number(y);
      if (diff !== 0) return diff;
    } else {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}

export default async function AdminSetupPage() {
  const [regions, locations, missions, ingredients] = await Promise.all([
    prisma.region.findMany({ orderBy: { name: "asc" } }),
    prisma.location.findMany({
      include: { region: true, mission1: true, mission2: true, ingredients: true },
      orderBy: [
        { isActive: "desc" },
        { region: { name: "asc" } },
        { name: "asc" },
      ],
    }),
    prisma.mission.findMany(),
    prisma.ingredient.findMany({ orderBy: { id: "asc" } }),
  ]);

  missions.sort((a, b) => {
    const t =
      MISSION_TYPE_ORDER.indexOf(a.type) - MISSION_TYPE_ORDER.indexOf(b.type);
    return t !== 0 ? t : naturalCompare(a.content, b.content);
  });

  const missionOptions = missions.map((m) => ({
    id: m.id,
    label: `${MISSION_LABEL[m.type] ?? m.type} — ${m.content || "(자유곡)"}`,
  }));
  const ingredientOptions = ingredients.map((ing) => ({
    id: ing.id,
    label: ing.name,
  }));

  return (
    <main className="mx-auto max-w-[1600px] space-y-8 p-4">
      <h1 className="text-xl font-bold">어드민 설정</h1>

      {/* 지역 (읽기 전용) */}
      <section>
        <h2 className="mb-2 text-sm font-bold text-zinc-500">지역</h2>
        <p className="text-sm">{regions.map((r) => r.name).join(", ")}</p>
      </section>

      {/* 미션 */}
      <section>
        <h2 className="mb-2 text-sm font-bold text-zinc-500">미션</h2>
        <ul className="mb-3 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-4">
          {missions.map((m) => (
            <li
              key={m.id}
              className="flex min-w-0 flex-col gap-2 rounded border border-zinc-200 p-2 text-sm"
            >
              <div className="flex items-center gap-2">
                {m.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.imageUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded object-cover"
                  />
                )}
                <span className="min-w-0 flex-1 break-keep whitespace-pre-line">
                  <span className="font-medium">
                    {MISSION_LABEL[m.type] ?? m.type}
                  </span>{" "}
                  — {m.content || "(자유곡)"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-1.5">
                <MissionEditor
                  missionId={m.id}
                  currentType={m.type}
                  currentContent={m.content}
                />
                <form action={deleteMission} className="shrink-0">
                  <input type="hidden" name="id" value={m.id} />
                  <ConfirmDeleteButton
                    confirmText={`"${MISSION_LABEL[m.type] ?? m.type} — ${m.content || "자유곡"}" 미션을 삭제하시겠습니까?`}
                  />
                </form>
                <MissionPhotoUpload missionId={m.id} hasPhoto={!!m.imageUrl} />
              </div>
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
            <option value="CONFESSION">고백</option>
          </select>
          <textarea
            name="content"
            placeholder="본문/기도 주제/고백 지시문 (찬양은 비워둬도 됨). Enter로 줄바꿈 가능"
            rows={2}
            className="h-16 flex-1 resize-y rounded border border-zinc-300 p-2 text-sm"
          />
          <input
            type="file"
            name="photo"
            accept="image/*"
            title="문제 사진(선택)"
            className="w-32 text-xs"
          />
          <button className="rounded bg-zinc-900 px-3 py-2 text-sm text-white">
            추가
          </button>
        </form>
      </section>

      {/* 재료 */}
      <section>
        <h2 className="mb-2 text-sm font-bold text-zinc-500">재료</h2>
        <ul className="mb-3 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-1">
          {ingredients.map((ing) => (
            <li
              key={ing.id}
              className="flex items-center justify-between rounded border border-zinc-200 p-2 text-sm"
            >
              <span>{ing.name}</span>
              <div className="flex items-center gap-2">
                <IngredientEditor ingredientId={ing.id} currentName={ing.name} />
                <form action={deleteIngredient}>
                  <input type="hidden" name="id" value={ing.id} />
                  <ConfirmDeleteButton
                    confirmText={`"${ing.name}" 재료를 삭제하시겠습니까?`}
                  />
                </form>
              </div>
            </li>
          ))}
        </ul>
        <form
          action={createIngredient}
          className="flex flex-wrap items-center gap-2 rounded border border-zinc-200 p-3"
        >
          <input
            name="name"
            placeholder="이름 (예: 떡(치즈떡))"
            required
            className="rounded border border-zinc-300 p-2 text-sm"
          />
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
        <ul className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {locations.map((loc) => (
            <li
              key={loc.id}
              className={`flex flex-col gap-2 rounded border border-zinc-200 p-2 text-sm ${loc.isActive ? "" : "bg-zinc-50 opacity-60"}`}
            >
              <div className="flex gap-2">
                {loc.referencePhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={loc.referencePhotoUrl}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-dashed border-zinc-300 text-center text-[9px] text-zinc-400">
                    사진 없음
                  </div>
                )}
                <div className="min-w-0">
                  <p className="break-keep font-medium">
                    {loc.region.name}지역 · {loc.name}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                  </p>
                  <p className="text-xs text-zinc-500">
                    캡 {loc.claimedCount}/{loc.capacity}
                  </p>
                  <p className="text-xs text-zinc-500">
                    슬롯1: {loc.mission1 ? MISSION_LABEL[loc.mission1.type] : "없음"} ·
                    슬롯2: {loc.mission2 ? MISSION_LABEL[loc.mission2.type] : "없음"}
                  </p>
                  <p className="break-keep text-xs text-zinc-500">
                    재료:{" "}
                    {loc.ingredients.length > 0
                      ? loc.ingredients.map((ing) => ing.name).join(", ")
                      : "없음"}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <LocationPhotoUpload
                  locationId={loc.id}
                  hasPhoto={!!loc.referencePhotoUrl}
                />
                <div className="flex items-center gap-2">
                  <form action={toggleLocationActive}>
                    <input type="hidden" name="id" value={loc.id} />
                    <input
                      type="hidden"
                      name="isActive"
                      value={String(!loc.isActive)}
                    />
                    <button
                      type="submit"
                      className="text-xs font-medium text-zinc-600 underline"
                    >
                      {loc.isActive ? "비활성화" : "활성화"}
                    </button>
                  </form>
                  <form action={deleteLocation}>
                  <input type="hidden" name="id" value={loc.id} />
                  <ConfirmDeleteButton
                    confirmText={`"${loc.region.name}지역 · ${loc.name}" 포인트를 삭제하시겠습니까?\n연결된 제출/도움요청 기록도 함께 삭제됩니다.`}
                  />
                  </form>
                </div>
              </div>
              <LocationDetailsEditor
                locationId={loc.id}
                currentName={loc.name}
                currentLat={loc.lat}
                currentLng={loc.lng}
                currentMission1Id={loc.mission1Id}
                currentMission2Id={loc.mission2Id}
                currentIngredientIds={loc.ingredients.map((ing) => ing.id)}
                currentJudgePrompt={loc.judgePrompt}
                missions={missionOptions}
                ingredients={ingredientOptions}
                existingLocations={locations
                  .filter((other) => other.isActive && other.id !== loc.id)
                  .map((other) => ({
                    id: other.id,
                    name: other.name,
                    regionName: other.region.name,
                    lat: other.lat,
                    lng: other.lng,
                  }))}
              />
            </li>
          ))}
        </ul>

        <LocationForm
          regions={regions.map((r) => ({ id: r.id, label: r.name }))}
          missions={missionOptions}
          ingredients={ingredientOptions}
          existingLocations={locations.filter((loc) => loc.isActive).map((loc) => ({
            id: loc.id,
            name: loc.name,
            regionName: loc.region.name,
            lat: loc.lat,
            lng: loc.lng,
          }))}
        />
      </section>
    </main>
  );
}
