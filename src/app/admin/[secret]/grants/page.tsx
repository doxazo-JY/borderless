import { prisma } from "@/lib/prisma";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import { confirmGrant, resetSubmission } from "./actions";

export default async function GrantsPage({
  params,
}: {
  params: Promise<{ secret: string }>;
}) {
  const { secret } = await params;

  const [pending, confirmed] = await Promise.all([
    prisma.submission.findMany({
      where: { aiPassed: true, grantStatus: "PENDING" },
      include: {
        group: true,
        location: { include: { region: true, ingredients: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.submission.findMany({
      where: { aiPassed: true, grantStatus: "CONFIRMED" },
      include: { group: true, location: { include: { region: true } } },
      orderBy: { confirmedAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <main className="mx-auto max-w-xl space-y-6 p-4">
      <h1 className="text-xl font-bold">지급 확정</h1>
      <p className="text-xs text-zinc-500">
        캡은 이미 판정 통과 시점에 확정돼 있어요 — 이 버튼은 실제로 재료를
        건네줬다는 기록용입니다.
      </p>

      <section>
        <h2 className="mb-2 text-sm font-bold text-zinc-500">
          대기중 ({pending.length})
        </h2>
        {pending.length === 0 && (
          <p className="text-sm text-zinc-400">지급 대기중인 건이 없어요.</p>
        )}
        <ul className="space-y-2">
          {pending.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded border border-amber-200 bg-amber-50 p-3"
            >
              <div className="text-sm">
                <p className="font-semibold">{s.group.displayName}</p>
                <p className="text-xs text-zinc-500">
                  {s.location.region.name}지역 · {s.location.name}
                </p>
                {s.location.ingredients.length > 0 && (
                  <p className="text-xs text-zinc-500">
                    재료:{" "}
                    {s.location.ingredients
                      .map((i) => i.name + (i.variant ? `(${i.variant})` : ""))
                      .join(", ")}
                  </p>
                )}
                <p className="text-xs text-zinc-400">
                  영상: {s.videoUrl ? "제출됨" : "미제출"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <form action={confirmGrant}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="secret" value={secret} />
                  <button className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white">
                    지급 확정
                  </button>
                </form>
                <form action={resetSubmission}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="secret" value={secret} />
                  <ConfirmDeleteButton
                    label="초기화"
                    confirmText={`${s.group.displayName}의 "${s.location.region.name}지역 · ${s.location.name}" 제출(사진${s.videoUrl ? "/영상" : ""})을 초기화할까요?\n캡이 되돌아가서 다시 시도할 수 있게 됩니다.`}
                  />
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-zinc-500">최근 지급 완료</h2>
        <ul className="space-y-2">
          {confirmed.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded border border-zinc-200 p-2"
            >
              <span className="text-xs text-zinc-500">
                {s.group.displayName} · {s.location.region.name}지역 ·{" "}
                {s.location.name}
              </span>
              <form action={resetSubmission}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="secret" value={secret} />
                <ConfirmDeleteButton
                  label="초기화"
                  confirmText={`${s.group.displayName}의 "${s.location.region.name}지역 · ${s.location.name}" 제출을 초기화할까요?\n지급 확정 기록도 함께 사라지고, 캡이 되돌아가서 다시 시도할 수 있게 됩니다.`}
                />
              </form>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
