import { prisma } from "@/lib/prisma";
import { TeamGroupSelect } from "@/components/TeamGroupSelect";

export default async function Home() {
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
