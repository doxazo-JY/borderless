import { prisma } from "@/lib/prisma";
import { resolveHelpRequest } from "./actions";

export default async function HelpRequestsPage({
  params,
}: {
  params: Promise<{ secret: string }>;
}) {
  const { secret } = await params;

  const [open, resolved] = await Promise.all([
    prisma.helpRequest.findMany({
      where: { status: "OPEN" },
      include: { group: true, location: { include: { region: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.helpRequest.findMany({
      where: { status: "RESOLVED" },
      include: { group: true, location: { include: { region: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <main className="mx-auto max-w-xl space-y-6 p-4">
      <h1 className="text-xl font-bold">도움 요청</h1>

      <section>
        <h2 className="mb-2 text-sm font-bold text-zinc-500">
          대기중 ({open.length})
        </h2>
        {open.length === 0 && (
          <p className="text-sm text-zinc-400">열려있는 요청이 없어요.</p>
        )}
        <ul className="space-y-2">
          {open.map((hr) => (
            <li
              key={hr.id}
              className="flex items-center justify-between rounded border border-red-200 bg-red-50 p-3"
            >
              <div className="text-sm">
                <p className="font-semibold">{hr.group.displayName}</p>
                <p className="text-xs text-zinc-500">
                  {hr.location
                    ? `${hr.location.region.name}지역 · ${hr.location.name}`
                    : "장소 지정 없음"}{" "}
                  · {new Date(hr.createdAt).toLocaleTimeString("ko-KR")}
                </p>
              </div>
              <form action={resolveHelpRequest}>
                <input type="hidden" name="id" value={hr.id} />
                <input type="hidden" name="secret" value={secret} />
                <button className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white">
                  해결됨
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-zinc-500">
          최근 처리됨
        </h2>
        <ul className="space-y-1">
          {resolved.map((hr) => (
            <li key={hr.id} className="text-xs text-zinc-400">
              {hr.group.displayName} ·{" "}
              {hr.location
                ? `${hr.location.region.name}지역 · ${hr.location.name}`
                : "장소 지정 없음"}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
