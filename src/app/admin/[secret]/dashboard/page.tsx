import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const [teams, locations] = await Promise.all([
    prisma.team.findMany({
      orderBy: { name: "asc" },
      include: {
        groups: {
          orderBy: { groupNumber: "asc" },
          include: {
            submissions: { where: { aiPassed: true }, include: { location: true } },
            regionOrder: { orderBy: { position: "asc" }, include: { region: true } },
          },
        },
      },
    }),
    prisma.location.findMany({
      include: { region: true },
      orderBy: [{ region: { name: "asc" } }, { name: "asc" }],
    }),
  ]);

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-4">
      <h1 className="text-xl font-bold">대시보드</h1>
      <p className="text-xs text-zinc-500">
        임원 전용 — 참가자에게는 절대 노출되지 않습니다.
      </p>

      <section>
        <h2 className="mb-2 text-sm font-bold text-zinc-500">그룹별 진행</h2>
        <ul className="space-y-2">
          {teams.flatMap((t) =>
            t.groups.map((g) => {
              const passedRegionIds = new Set(
                g.submissions.map((s) => s.location.regionId),
              );
              const order = g.regionOrder.map((o) => o.region.name);
              return (
                <li
                  key={g.id}
                  className="rounded border border-zinc-200 p-3 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{g.displayName}</span>
                    <span className="text-xs text-zinc-500">
                      {passedRegionIds.size} / 4 지역 완료
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">
                    순서: {order.join(" → ") || "미설정"}
                  </p>
                </li>
              );
            }),
          )}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-zinc-500">
          포인트별 잔여 캡
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className={`rounded border p-2 text-center text-xs ${
                loc.claimedCount >= loc.capacity
                  ? "border-zinc-300 bg-zinc-100 text-zinc-400"
                  : "border-green-300 bg-green-50 text-green-700"
              }`}
            >
              <p className="font-semibold">
                {loc.region.name}·{loc.name.replace(/\(더미\)/, "")}
              </p>
              <p>
                {loc.claimedCount}/{loc.capacity}
                {loc.claimedCount >= loc.capacity ? " 마감" : " 여유"}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
