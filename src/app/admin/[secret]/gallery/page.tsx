import { prisma } from "@/lib/prisma";
import { MissionPlaylist, type PlaylistItem } from "@/components/admin/MissionPlaylist";
import { PhotoLightbox, type PhotoItem, type PhotoGroup } from "@/components/admin/PhotoLightbox";
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

// 말씀(WORD)은 슬롯1이 전반부·슬롯2가 후반부라 둘을 이어야 본문이 완성된다(예: 시편
// 119편 1~96절 다음에 97~176절) — 반대로 찬양(PRAISE)은 슬롯1/2가 "찬양"/"워십"처럼
// 서로 다른 완성본이라 슬롯별로 따로 두는 게 맞는다. 그래서 WORD만 슬롯을 합친다.
const COMBINE_SLOTS_TYPES: MissionType[] = ["WORD"];

interface PlaylistGroup {
  regionName: string;
  type: MissionType;
  slot: 1 | 2 | null; // null이면 슬롯1+2를 이어붙인 그룹
  items: PlaylistItem[];
}

export default async function GalleryPage() {
  const [passedSubmissions, photoSubmissions, locations] = await Promise.all([
    // 나중에 지역·슬롯별로 영상을 이어붙일 소재라 통과 + 영상 있는 것만 대상으로 한다
    // (판정 모니터링은 팀 탭의 역할 — 여긴 결과물 모음).
    prisma.submission.findMany({
      where: { aiPassed: true, videoUrl: { not: null }, location: { isActive: true } },
      include: {
        group: true,
        location: { include: { region: true, mission1: true, mission2: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    // 사진은 통과/실패 구분 없이 포인트별로 들어온 순서 그대로 모아 회고용으로 보여준다
    // (판정 대응용 모니터링은 팀 탭의 역할).
    prisma.submission.findMany({
      where: { photoUrl: { not: null }, location: { isActive: true } },
      include: { group: true, location: { include: { region: true } } },
      orderBy: { createdAt: "asc" },
    }),
    // 아직 아무도 통과하지 못한 슬롯도 "아직 없음"으로 보이도록, 제출과 무관하게
    // 지역의 미션1/미션2 설정에서 그룹 목록을 먼저 만들어둔다.
    prisma.location.findMany({
      where: { isActive: true },
      include: { region: true, mission1: true, mission2: true },
    }),
  ]);

  // 같은 지역·같은 슬롯끼리 이어야 하나의 완성본이 된다 (예: C1 미션1→C2 미션1→C3
  // 미션1→C4 미션1이 완성 영상 1개, 미션2끼리가 별도의 완성 영상 1개) — 슬롯이 섞이면
  // 안 되므로 지역+미션타입+슬롯 3중 기준으로 플레이리스트를 나눈다.
  const groupMap = new Map<string, PlaylistGroup>();

  function ensureGroup(regionId: string, regionName: string, type: MissionType, slot: 1 | 2) {
    const effectiveSlot = COMBINE_SLOTS_TYPES.includes(type) ? null : slot;
    const key = `${regionId}_${type}_${effectiveSlot ?? "all"}`;
    let group = groupMap.get(key);
    if (!group) {
      group = { regionName, type, slot: effectiveSlot, items: [] };
      groupMap.set(key, group);
    }
    return group;
  }

  for (const loc of locations) {
    if (loc.mission1) ensureGroup(loc.regionId, loc.region.name, loc.mission1.type, 1);
    if (loc.mission2) ensureGroup(loc.regionId, loc.region.name, loc.mission2.type, 2);
  }

  for (const s of passedSubmissions) {
    const slot = s.missionSlot === 2 ? 2 : 1;
    const mission = slot === 2 ? s.location.mission2 : s.location.mission1;
    if (!mission) continue;
    const group = ensureGroup(s.location.regionId, s.location.region.name, mission.type, slot);
    const locationLabel = s.location.name.replace(/\(더미\)/, "");
    const namePrefix = safeFilenamePart(
      `${MISSION_LABEL[mission.type]}_${s.location.region.name}_${s.location.name}_${s.group.displayName}`,
    );
    group.items.push({
      id: s.id,
      videoUrl: s.videoUrl!,
      locationLabel,
      slot,
      content: mission.content,
      downloadName: `${namePrefix}_영상.${extFromUrl(s.videoUrl!, "mp4")}`,
    });
  }

  for (const group of groupMap.values()) {
    // 슬롯을 합친 그룹(WORD)은 슬롯1 전체(포인트 순)가 끝난 뒤 슬롯2 전체가 이어져야 하므로
    // 슬롯을 1순위로, 포인트 이름을 2순위로 정렬한다.
    group.items.sort((a, b) => {
      const bySlot = (a.slot ?? 0) - (b.slot ?? 0);
      if (bySlot !== 0) return bySlot;
      return a.locationLabel.localeCompare(b.locationLabel, "ko", { numeric: true });
    });
  }

  const groups = Array.from(groupMap.values()).sort((a, b) => {
    const byRegion = a.regionName.localeCompare(b.regionName, "ko", { numeric: true });
    if (byRegion !== 0) return byRegion;
    const byType = MISSION_TYPE_ORDER.indexOf(a.type) - MISSION_TYPE_ORDER.indexOf(b.type);
    if (byType !== 0) return byType;
    return (a.slot ?? 0) - (b.slot ?? 0);
  });

  // 지역별로 한 줄씩 — 그룹이 2개면 2열, 1개(WORD처럼 슬롯을 합친 경우)면 가운데 정렬 1열.
  const regionRows: { regionName: string; groups: PlaylistGroup[] }[] = [];
  for (const group of groups) {
    const lastRow = regionRows[regionRows.length - 1];
    if (lastRow && lastRow.regionName === group.regionName) {
      lastRow.groups.push(group);
    } else {
      regionRows.push({ regionName: group.regionName, groups: [group] });
    }
  }

  // 포인트(지역+장소)별로 묶고, 그 안에서는 들어온 순서(createdAt asc, 쿼리에서 이미 정렬됨)
  // 그대로 — "A지역 a 포인트 들어오는 대로 쭉 -> A지역 b 포인트 들어오는 대로 쭉" 형태.
  // 제출이 아예 없는 포인트도 빈 그룹으로 남겨서, 뭐가 빠져있는지 한눈에 보이게 한다.
  const photoByLocation = new Map<string, PhotoItem[]>();
  for (const s of photoSubmissions) {
    const groupLabel = `${s.location.region.name}지역 · ${s.location.name.replace(/\(더미\)/, "")}`;
    const namePrefix = safeFilenamePart(
      `${s.location.region.name}_${s.location.name}_${s.group.displayName}`,
    );
    const list = photoByLocation.get(s.locationId) ?? [];
    list.push({
      id: s.id,
      photoUrl: s.photoUrl!,
      label: `${groupLabel} · ${s.group.displayName}`,
      downloadName: `${namePrefix}_${s.aiPassed ? "성공" : "실패"}사진.${extFromUrl(s.photoUrl!, "jpg")}`,
      passed: s.aiPassed === true,
    });
    photoByLocation.set(s.locationId, list);
  }

  const photoGroups: PhotoGroup[] = [...locations]
    .sort((a, b) =>
      `${a.region.name}${a.name}`.localeCompare(`${b.region.name}${b.name}`, "ko", { numeric: true }),
    )
    .map((loc) => {
      const locationLabel = loc.name.replace(/\(더미\)/, "");
      const namePrefix = safeFilenamePart(`${loc.region.name}_${loc.name}`);
      return {
        groupLabel: `${loc.region.name}지역 · ${locationLabel}`,
        items: photoByLocation.get(loc.id) ?? [],
        referencePhotoUrl: loc.referencePhotoUrl,
        referenceDownloadName: loc.referencePhotoUrl
          ? `${namePrefix}_기준사진.${extFromUrl(loc.referencePhotoUrl, "jpg")}`
          : undefined,
      };
    });

  return (
    <main className="mx-auto max-w-[1200px] space-y-10 p-4">
      <h1 className="text-xl font-bold">갤러리</h1>

      <section>
        <h2 className="mb-1 text-lg font-bold">완성 영상</h2>
        <p className="mb-3 text-xs text-zinc-400">
          지역·슬롯별로 이어 재생됩니다 — 영상이 끝나면 자동으로 다음 포인트로 넘어갑니다.
        </p>
        <div className="space-y-3">
          {regionRows.map((row) => (
            <div
              key={row.regionName}
              className={row.groups.length === 1 ? "flex justify-center" : "grid grid-cols-2 gap-3"}
            >
              {row.groups.map((group) => {
                const title = `${group.regionName}지역 · ${MISSION_LABEL[group.type]}${
                  group.slot ? ` · 미션${group.slot}` : ""
                }`;
                const key = `${group.regionName}_${group.type}_${group.slot ?? "all"}`;
                const wrapperClassName = row.groups.length === 1 ? "w-1/2" : "";
                if (group.items.length === 0) {
                  return (
                    <div
                      key={key}
                      className={`${wrapperClassName} flex aspect-video w-full flex-col items-center justify-center gap-1 rounded border border-dashed border-zinc-300 bg-zinc-50 p-2 text-center`}
                    >
                      <p className="text-xs font-medium text-zinc-500">{title}</p>
                      <p className="text-[10px] text-zinc-400">아직 없음</p>
                    </div>
                  );
                }
                return (
                  <div key={key} className={wrapperClassName}>
                    <MissionPlaylist title={title} items={group.items} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-bold">사진 모아보기</h2>
        <p className="mb-3 text-xs text-zinc-400">
          지역·포인트 순으로, 그 포인트에 들어온 순서 그대로 모았습니다 (통과/실패 표시).
        </p>
        {photoGroups.every((g) => g.items.length === 0) ? (
          <p className="text-xs text-zinc-400">없음</p>
        ) : (
          <PhotoLightbox groups={photoGroups} />
        )}
      </section>
    </main>
  );
}
