import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentGroup } from "@/lib/group";
import { prisma } from "@/lib/prisma";

const GRANT_LABEL: Record<string, string> = {
  PENDING: "지급 대기중",
  CONFIRMED: "지급 완료",
};

export default async function InventoryPage() {
  const group = await getCurrentGroup();
  if (!group) {
    redirect("/");
  }

  const submissions = await prisma.submission.findMany({
    where: { groupId: group.id, aiPassed: true },
    include: { location: { include: { region: true, ingredients: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <main className="flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <div>
          <p className="text-xs text-zinc-500">{group.displayName}</p>
          <h1 className="text-lg font-bold">인벤토리</h1>
        </div>
        <Link
          href="/map"
          className="text-xs text-zinc-500 underline underline-offset-2"
        >
          지도로 돌아가기
        </Link>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {submissions.length === 0 && (
          <p className="text-sm text-zinc-400">
            아직 통과한 포인트가 없어요. 지도에서 미션을 진행해보세요.
          </p>
        )}

        {submissions.map((s) => (
          <div key={s.id} className="rounded-lg border border-zinc-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-500">
                  {s.location.region.name}지역
                </p>
                <p className="text-sm font-semibold">{s.location.name}</p>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${
                  s.grantStatus === "CONFIRMED"
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {GRANT_LABEL[s.grantStatus] ?? s.grantStatus}
              </span>
            </div>

            {s.location.ingredients.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {s.location.ingredients.map((ing) => (
                  <li
                    key={ing.id}
                    className="rounded-full bg-zinc-100 px-2 py-1 text-xs"
                  >
                    {ing.name}
                    {ing.variant ? ` (${ing.variant})` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-zinc-400">연결된 재료 없음 (더미 데이터)</p>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
