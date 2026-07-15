import { prisma } from "@/lib/prisma";
import { selectGroup } from "@/app/actions";
import { teamColor } from "@/lib/team-colors";

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

      <div className="grid w-full max-w-sm gap-6">
        {teams.map((team) => (
          <div key={team.id}>
            <h2
              className="label-tech mb-2 text-xs font-bold"
              style={{ color: teamColor(team.name) }}
            >
              {team.name}팀
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {team.groups.map((group) => (
                <form key={group.id} action={selectGroup}>
                  <input type="hidden" name="groupId" value={group.id} />
                  <button
                    type="submit"
                    className="w-full rounded-lg border-2 py-4 text-lg font-bold transition-colors"
                    style={{
                      borderColor: teamColor(team.name),
                      color: "var(--color-ink)",
                      background: "var(--color-paper-panel)",
                    }}
                  >
                    {group.displayName}
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
