import { prisma } from "@/lib/prisma";
import { selectGroup } from "@/app/actions";

export default async function Home() {
  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    include: { groups: { orderBy: { groupNumber: "asc" } } },
  });

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Borderless</h1>
        <p className="mt-2 text-sm text-zinc-500">소속된 팀과 조를 선택하세요</p>
      </div>

      <div className="grid w-full max-w-sm gap-6">
        {teams.map((team) => (
          <div key={team.id}>
            <h2 className="mb-2 text-sm font-semibold text-zinc-500">
              {team.name}팀
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {team.groups.map((group) => (
                <form key={group.id} action={selectGroup}>
                  <input type="hidden" name="groupId" value={group.id} />
                  <button
                    type="submit"
                    className="w-full rounded-lg border border-zinc-300 py-4 text-lg font-medium transition-colors hover:bg-zinc-50"
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
