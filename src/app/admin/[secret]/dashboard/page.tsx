import { prisma } from "@/lib/prisma";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import { confirmGrant, resetAllSubmissions, resetSubmission } from "./actions";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ secret: string }>;
}) {
  const { secret } = await params;

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
      include: {
        region: true,
        mission: true,
        submissions: {
          where: { aiPassed: true },
          include: { group: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [
        { isActive: "desc" },
        { region: { name: "asc" } },
        { name: "asc" },
      ],
    }),
  ]);

  return (
    <main className="mx-auto max-w-7xl space-y-8 p-4">
      <h1 className="text-xl font-bold">대시보드</h1>
      <p className="text-xs text-zinc-500">
        임원 전용 — 참가자에게는 절대 노출되지 않습니다.
      </p>

      <section>
        <h2 className="mb-2 text-sm font-bold text-zinc-500">그룹별 진행</h2>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-500">포인트별 현황</h2>
          <form action={resetAllSubmissions}>
            <input type="hidden" name="secret" value={secret} />
            <ConfirmDeleteButton
              label="전체 초기화"
              className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-600"
              confirmText="모든 그룹의 모든 제출(사진/영상/정답/지급 확정 기록)을 전부 지우고 포인트 캡도 전부 되돌릴까요?\n답사/리허설 데이터를 한 번에 정리할 때만 쓰세요 — 되돌릴 수 없습니다."
            />
          </form>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className={`rounded border p-2 text-xs ${
                !loc.isActive
                  ? "border-zinc-200 bg-zinc-50 opacity-60"
                  : loc.claimedCount >= loc.capacity
                    ? "border-zinc-300 bg-zinc-100"
                    : "border-zinc-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-zinc-700">
                  {loc.region.name}·{loc.name.replace(/\(더미\)/, "")}
                  {!loc.isActive && " (비활성)"}
                </p>
                <p className="text-zinc-400">
                  {loc.claimedCount}/{loc.capacity}
                  {loc.claimedCount >= loc.capacity ? " 마감" : " 여유"}
                </p>
              </div>

              {loc.submissions.length === 0 ? (
                <p className="mt-2 text-zinc-400">아직 통과한 그룹 없음</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {loc.submissions.map((s) => (
                    <div
                      key={s.id}
                      className="rounded border border-zinc-200 bg-white p-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-zinc-700">
                          {s.group.displayName}
                        </span>
                        {s.grantStatus === "CONFIRMED" ? (
                          <span className="text-[10px] font-medium text-green-600">
                            지급 확정됨
                          </span>
                        ) : (
                          <form action={confirmGrant}>
                            <input type="hidden" name="id" value={s.id} />
                            <input type="hidden" name="secret" value={secret} />
                            <button className="rounded bg-zinc-900 px-2 py-1 text-[10px] text-white">
                              지급 확정
                            </button>
                          </form>
                        )}
                      </div>

                      <div className="mt-1 flex items-start gap-2">
                        {s.photoUrl && (
                          <a href={s.photoUrl} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={s.photoUrl}
                              alt=""
                              className="h-14 w-14 shrink-0 rounded object-cover"
                            />
                          </a>
                        )}
                        <div className="min-w-0 flex-1">
                          {loc.mission?.type === "PUZZLE" ? (
                            <p className="text-zinc-500">
                              정답:{" "}
                              {s.answerCorrect
                                ? s.answerText || "제출됨"
                                : "미제출"}
                            </p>
                          ) : s.videoUrl ? (
                            <video
                              src={s.videoUrl}
                              controls
                              className="w-full rounded"
                            />
                          ) : (
                            <p className="text-zinc-400">영상 대기</p>
                          )}
                        </div>
                      </div>

                      <form action={resetSubmission} className="mt-1">
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="secret" value={secret} />
                        <ConfirmDeleteButton
                          label="초기화"
                          confirmText={`${s.group.displayName}의 "${loc.region.name}지역 · ${loc.name}" 제출을 초기화할까요?\n지급 확정 기록도 함께 사라지고, 캡이 되돌아가서 다시 시도할 수 있게 됩니다.`}
                        />
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
