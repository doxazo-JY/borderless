import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { selectGroup } from "@/app/actions";
import { getCurrentGroup } from "@/lib/group";
import { getAppSettings } from "@/lib/settings";
import { teamColor } from "@/lib/team-colors";
import { BrandMark } from "@/components/BrandMark";
import { MapDecoration } from "@/components/MapDecoration";
import { ParchmentBurn } from "@/components/ParchmentBurn";
import { ParchmentCompass } from "@/components/ParchmentCompass";

export default async function Home() {
  const [group, settings] = await Promise.all([
    getCurrentGroup(),
    getAppSettings(),
  ]);
  // 팀 선택이 잠긴 뒤에는 이미 소속을 고른 기기가 실수로(뒤로가기 등) 이 화면으로
  // 돌아와도 다시 지도로 보낸다 — 잠긴 상태에서 이 화면에 머물 이유가 없음.
  if (group && settings.groupSelectionLocked) {
    redirect("/map");
  }

  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    include: { groups: { orderBy: { groupNumber: "asc" } } },
  });

  return (
    <main className="route-map relative flex flex-1 flex-col items-center justify-center gap-10 overflow-hidden px-6 py-16 text-ink">
      <ParchmentBurn />
      <MapDecoration />
      <ParchmentCompass className="parchment-compass-fixed" />
      <div className="map-selection-header relative z-10 text-center">
        <BrandMark className="mx-auto mb-3 h-10 w-10" />
        <div className="flex items-center justify-center gap-3">
          <span className="h-px w-8 bg-line" />
          <p className="label-tech text-xs text-accent">Borderless</p>
          <span className="h-px w-8 bg-line" />
        </div>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight uppercase">
          소속 선택
        </h1>
        <p className="mt-2 text-sm text-muted">소속된 팀과 조를 선택하세요</p>
      </div>

      <div className="relative z-10 grid w-full max-w-sm gap-6">
        {teams.map((team) => (
          <div key={team.id}>
            <h2
              className="label-tech mb-2 text-xs font-bold"
              style={{ color: teamColor(team.name) }}
            >
              {team.name}팀
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {team.groups.map((g) => (
                <form key={g.id} action={selectGroup}>
                  <input type="hidden" name="groupId" value={g.id} />
                  <button
                    type="submit"
                    className="shadow-panel w-full rounded-lg border-2 py-4 text-lg font-bold transition-transform active:scale-[0.98]"
                    style={{
                      borderColor: teamColor(team.name),
                      color: "var(--color-ink)",
                      background: `color-mix(in srgb, ${teamColor(team.name)} 8%, var(--color-paper-panel))`,
                    }}
                  >
                    {g.displayName}
                  </button>
                </form>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
