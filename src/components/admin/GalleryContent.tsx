import { prisma } from "@/lib/prisma";
import { MissionPlaylist, type PlaylistItem } from "@/components/admin/MissionPlaylist";
import { PhotoLightbox, type PhotoItem, type PhotoGroup } from "@/components/admin/PhotoLightbox";
import { BulkDownloadButton, type DownloadFile } from "@/components/admin/BulkDownloadButton";
import type { MissionType } from "@/generated/prisma/enums";

const MISSION_LABEL: Record<string, string> = {
  WORD: "말씀",
  PRAISE: "찬양",
  PRAYER: "기도",
  CONFESSION: "고백",
};

function extFromUrl(url: string, fallback: string): string {
  const match = url.split("?")[0].match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1] : fallback;
}

function safeFilenamePart(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, "-").trim();
}

interface PlaylistGroup {
  regionName: string;
  type: MissionType;
  items: PlaylistItem[];
}

// 어드민의 "갤러리" 탭과, 임원 외 다른 사람에게 링크만 따로 공유하기 위한
// /gallery/[secret] 페이지가 이 내용을 그대로 같이 쓴다 — 데이터/화면 구성은
// 완전히 동일하고, 두 라우트는 서로 다른 비밀 경로로만 각자 접근을 막는다.
// readOnly는 공유 링크 쪽에서만 true로 켜서 다운로드/영상 교체 같은 편집성
// 기능을 감춘다 — 임원이 아닌 사람에게 실수로 파일을 바꿀 여지를 안 주려는 것.
export async function GalleryContent({ readOnly = false }: { readOnly?: boolean }) {
  const [passedSubmissions, photoSubmissions, locations] = await Promise.all([
    // 나중에 지역·슬롯별로 영상을 이어붙일 소재라 통과 + 영상 있는 것만 대상으로 한다
    // (판정 모니터링은 팀 탭의 역할 — 여긴 결과물 모음).
    prisma.submission.findMany({
      where: {
        aiPassed: true,
        videoUrl: { not: null },
        hiddenInGallery: false,
        location: { isActive: true },
      },
      include: {
        group: true,
        location: { include: { region: true, mission1: true, mission2: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    // 사진은 통과/실패 구분 없이 포인트별로 들어온 순서 그대로 모아 회고용으로 보여준다
    // (판정 대응용 모니터링은 팀 탭의 역할).
    prisma.submission.findMany({
      where: { photoUrl: { not: null }, hiddenInGallery: false, location: { isActive: true } },
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

  // 같은 지역·같은 미션타입끼리는 슬롯1/2 구분 없이 하나로 이어붙인다 — 지역 하나당
  // 미션 타입이 하나뿐이라(A=고백, B=기도, C=말씀, D=찬양), 결과적으로 지역당 완성
  // 영상 하나씩, 총 4개가 된다.
  const groupMap = new Map<string, PlaylistGroup>();

  function ensureGroup(regionId: string, regionName: string, type: MissionType) {
    const key = `${regionId}_${type}`;
    let group = groupMap.get(key);
    if (!group) {
      group = { regionName, type, items: [] };
      groupMap.set(key, group);
    }
    return group;
  }

  for (const loc of locations) {
    if (loc.mission1) ensureGroup(loc.regionId, loc.region.name, loc.mission1.type);
    if (loc.mission2) ensureGroup(loc.regionId, loc.region.name, loc.mission2.type);
  }

  for (const s of passedSubmissions) {
    const slot = s.missionSlot === 2 ? 2 : 1;
    const mission = slot === 2 ? s.location.mission2 : s.location.mission1;
    if (!mission) continue;
    const group = ensureGroup(s.location.regionId, s.location.region.name, mission.type);
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
    // 슬롯1 전체(포인트 순)가 끝난 뒤 슬롯2 전체가 이어지도록, 슬롯을 1순위로,
    // 포인트 이름을 2순위로 정렬한다.
    group.items.sort((a, b) => {
      const bySlot = (a.slot ?? 0) - (b.slot ?? 0);
      if (bySlot !== 0) return bySlot;
      return a.locationLabel.localeCompare(b.locationLabel, "ko", { numeric: true });
    });
  }

  // "영상만 전체 zip 다운로드"용 — 위에서 이미 지역·미션별로 다듬어둔 downloadName을
  // 그대로 재사용해서 사진과 별도로 영상만 모아 받을 수 있게 한다.
  const videoDownloadFiles: DownloadFile[] = Array.from(groupMap.values()).flatMap(
    (group) => group.items.map((item) => ({ url: item.videoUrl, filename: item.downloadName })),
  );

  // 지역 하나당 미션 타입이 하나뿐이라 그룹이 정확히 4개(A~D) 나온다 — 2열 2행 그리드로
  // 바로 깔기 좋게 지역 이름 순으로만 정렬한다.
  const groups = Array.from(groupMap.values()).sort((a, b) =>
    a.regionName.localeCompare(b.regionName, "ko", { numeric: true }),
  );

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
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">완성 영상</h2>
          {!readOnly && (
            <BulkDownloadButton files={videoDownloadFiles} zipNamePrefix="완성영상" />
          )}
        </div>
        <p className="mb-3 text-xs text-zinc-400">
          지역별로 이어 재생됩니다 — 영상이 끝나면 자동으로 다음 포인트로 넘어갑니다.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {groups.map((group) => {
            const title = `${group.regionName}지역 · ${MISSION_LABEL[group.type]}`;
            const key = `${group.regionName}_${group.type}`;
            if (group.items.length === 0) {
              return (
                <div
                  key={key}
                  className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded border border-dashed border-zinc-300 bg-zinc-50 p-2 text-center"
                >
                  <p className="text-xs font-medium text-zinc-500">{title}</p>
                  <p className="text-[10px] text-zinc-400">아직 없음</p>
                </div>
              );
            }
            return (
              <MissionPlaylist key={key} title={title} items={group.items} readOnly={readOnly} />
            );
          })}
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
