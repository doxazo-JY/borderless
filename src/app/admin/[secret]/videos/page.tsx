import { prisma } from "@/lib/prisma";

export default async function VideosPage() {
  const submissions = await prisma.submission.findMany({
    where: { videoUrl: { not: null } },
    include: { group: true, location: { include: { region: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-xl font-bold">제출 영상 ({submissions.length}개)</h1>

      {submissions.length === 0 && (
        <p className="text-sm text-zinc-400">아직 제출된 영상이 없어요.</p>
      )}

      <ul className="space-y-4">
        {submissions.map((s) => (
          <li key={s.id} className="rounded border border-zinc-200 p-3">
            <p className="mb-2 text-sm font-semibold">
              {s.group.displayName} · {s.location.region.name}지역 ·{" "}
              {s.location.name}
            </p>
            <video
              src={s.videoUrl ?? undefined}
              controls
              className="w-full max-w-sm rounded"
            />
            <a
              href={s.videoUrl ?? "#"}
              download
              className="mt-2 inline-block text-xs text-zinc-500 underline underline-offset-2"
            >
              다운로드
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
