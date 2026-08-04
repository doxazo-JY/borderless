import { prisma } from "@/lib/prisma";
import { DownloadLink } from "@/components/admin/DownloadLink";
import type { MissionType } from "@/generated/prisma/enums";

const MISSION_LABEL: Record<string, string> = {
  WORD: "말씀",
  PRAISE: "찬양",
  PRAYER: "기도",
  CONFESSION: "고백",
};

const MISSION_TYPE_ORDER: MissionType[] = ["WORD", "PRAISE", "PRAYER", "CONFESSION"];

function extFromUrl(url: string, fallback: string): string {
  const match = url.split("?")[0].match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1] : fallback;
}

function safeFilenamePart(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, "-").trim();
}

export default async function GalleryPage() {
  const [passedSubmissions, failedSubmissions] = await Promise.all([
    // 나중에 미션 타입별로 영상을 이어붙일 소재라 통과 + 영상 있는 것만 대상으로 한다
    // (판정 모니터링은 팀 탭의 역할 — 여긴 결과물 모음).
    prisma.submission.findMany({
      where: { aiPassed: true, videoUrl: { not: null }, location: { isActive: true } },
      include: {
        group: true,
        location: { include: { region: true, mission1: true, mission2: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    // 실패 사진은 판정 대응용이 아니라 다 끝나고 회고용으로 몰아보는 용도라
    // 포인트별로 세분화하지 않고 그냥 하나의 그리드로 보여준다.
    prisma.submission.findMany({
      where: { aiPassed: false, photoUrl: { not: null }, location: { isActive: true } },
      include: { group: true, location: { include: { region: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const passedByMissionType = new Map<MissionType, typeof passedSubmissions>();
  for (const s of passedSubmissions) {
    const mission = s.missionSlot === 2 ? s.location.mission2 : s.location.mission1;
    if (!mission) continue;
    const list = passedByMissionType.get(mission.type) ?? [];
    list.push(s);
    passedByMissionType.set(mission.type, list);
  }

  return (
    <main className="mx-auto max-w-[1200px] space-y-10 p-4">
      <h1 className="text-xl font-bold">갤러리</h1>

      <section>
        <h2 className="mb-1 text-lg font-bold">완성 영상</h2>
        <p className="mb-3 text-xs text-zinc-400">
          미션 타입별로 모았습니다 — 이어붙일 때 참고하세요.
        </p>
        <div className="space-y-6">
          {MISSION_TYPE_ORDER.map((type) => {
            const items = passedByMissionType.get(type) ?? [];
            return (
              <div key={type}>
                <h3 className="mb-2 text-sm font-bold text-zinc-500">
                  {MISSION_LABEL[type]} ({items.length})
                </h3>
                {items.length === 0 ? (
                  <p className="text-xs text-zinc-400">아직 없음</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((s) => {
                      const namePrefix = safeFilenamePart(
                        `${MISSION_LABEL[type]}_${s.location.region.name}_${s.location.name}_${s.group.displayName}`,
                      );
                      return (
                        <div key={s.id} className="rounded border border-zinc-200 bg-white p-2">
                          <p className="mb-1 text-xs font-medium text-zinc-700">
                            {s.location.region.name}지역 · {s.location.name.replace(/\(더미\)/, "")} ·{" "}
                            {s.group.displayName}
                          </p>
                          <video
                            src={s.videoUrl!}
                            controls
                            className="max-h-[420px] w-full rounded bg-black object-contain"
                          />
                          <DownloadLink
                            url={s.videoUrl!}
                            filename={`${namePrefix}_영상.${extFromUrl(s.videoUrl!, "mp4")}`}
                            label="영상 받기"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-bold">실패 사진 모아보기</h2>
        <p className="mb-3 text-xs text-zinc-400">
          AI 판정에 실패했던 사진들입니다 — 다 끝나고 회고용으로 보기 좋게 모아뒀습니다.
        </p>
        {failedSubmissions.length === 0 ? (
          <p className="text-xs text-zinc-400">없음</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {failedSubmissions.map((s) => (
              <div key={s.id} className="rounded border border-red-200 bg-red-50 p-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.photoUrl!}
                  alt=""
                  className="h-32 w-full rounded object-cover"
                />
                <p className="mt-1 truncate text-[10px] text-zinc-500">
                  {s.location.region.name}·{s.location.name.replace(/\(더미\)/, "")} ·{" "}
                  {s.group.displayName}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
