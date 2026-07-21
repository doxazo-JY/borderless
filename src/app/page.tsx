import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TeamGroupSelect } from "@/components/TeamGroupSelect";
import { getCurrentGroup } from "@/lib/group";
import { getAppSettings } from "@/lib/settings";

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
    <main className="flex flex-1 flex-col items-center justify-center gap-10 bg-paper px-6 py-16 text-ink">
      <div className="text-center">
        <p className="label-tech text-xs text-accent">Borderless</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight uppercase">
          소속 선택
        </h1>
        <p className="mt-2 text-sm text-muted">소속된 팀과 조를 선택하세요</p>
      </div>

      <TeamGroupSelect teams={teams} />
    </main>
  );
}
