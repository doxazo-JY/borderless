import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentGroup } from "@/lib/group";
import { prisma } from "@/lib/prisma";
import { teamColor } from "@/lib/team-colors";

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
    <main className="flex flex-1 flex-col bg-paper text-ink">
      <div
        className="flex items-center justify-between border-b-4 px-4 py-3"
        style={{ borderColor: teamColor(group.team.name) }}
      >
        <div>
          <p className="label-tech text-[10px] text-muted">{group.displayName}</p>
          <h1 className="text-lg font-extrabold uppercase">인벤토리</h1>
        </div>
        <Link
          href="/map"
          className="label-tech text-[10px] text-muted underline underline-offset-2"
        >
          지도로 돌아가기
        </Link>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {submissions.length === 0 && (
          <p className="text-sm text-muted">
            아직 통과한 포인트가 없어요. 지도에서 미션을 진행해보세요.
          </p>
        )}

        {submissions.map((s) => (
          <div
            key={s.id}
            className="rounded-lg border-2 border-line bg-paper-panel p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="label-tech text-[10px] text-muted">
                  {s.location.region.name}지역
                </p>
                <p className="text-sm font-bold">{s.location.name}</p>
              </div>
              <span
                className={`label-tech rounded-full px-2 py-1 text-[10px] font-bold ${
                  s.grantStatus === "CONFIRMED"
                    ? "bg-accent text-paper"
                    : "border border-line bg-paper text-muted"
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
                    className="rounded-full border border-line bg-paper px-2 py-1 text-xs"
                  >
                    {ing.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted">연결된 재료 없음 (더미 데이터)</p>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
