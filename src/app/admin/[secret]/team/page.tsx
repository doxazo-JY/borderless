import { prisma } from "@/lib/prisma";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import { GroupLockToggle } from "@/components/admin/GroupLockToggle";
import { DownloadLink } from "@/components/admin/DownloadLink";
import { BulkDownloadButton, type DownloadFile } from "@/components/admin/BulkDownloadButton";
import { getAppSettings } from "@/lib/settings";
import {
  confirmGrant,
  resetAllSubmissions,
  resetSubmission,
  resolveHelpRequest,
  setGroupRegionOrder,
  updateGroupMembers,
} from "./actions";

const MISSION_LABEL: Record<string, string> = {
  WORD: "말씀",
  PRAISE: "찬양",
  PRAYER: "기도",
  CONFESSION: "고백",
};

// 파일명에 못 쓰는 문자를 안전하게 치환 — 지역/포인트/조 이름은 어드민이 자유
// 텍스트로 입력하는 값이라 그대로 쓰면 OS별 파일명 제약에 걸릴 수 있다.
function safeFilenamePart(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, "-").trim();
}

// URL 경로의 마지막 확장자를 그대로 살린다 — 못 찾으면 사진/영상별 기본값으로.
function extFromUrl(url: string, fallback: string): string {
  const match = url.split("?")[0].match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1] : fallback;
}

export default async function TeamPage() {
  const [teams, regions, locations, settings, openHelpRequests, resolvedHelpRequests] =
    await Promise.all([
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
      prisma.region.findMany({ orderBy: { name: "asc" } }),
      prisma.location.findMany({
        include: {
          region: true,
          mission1: true,
          mission2: true,
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
      getAppSettings(),
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

  // "전체 zip 다운로드"용 파일 목록 — 통과한 모든 제출의 사진/영상을 한 번에 모은다.
  const downloadFiles: DownloadFile[] = [];
  for (const loc of locations) {
    for (const s of loc.submissions) {
      const namePrefix = safeFilenamePart(
        `${loc.region.name}_${loc.name}_${s.group.displayName}${s.missionSlot ? `_슬롯${s.missionSlot}` : ""}`,
      );
      if (s.photoUrl) {
        downloadFiles.push({
          url: s.photoUrl,
          filename: `${namePrefix}_사진.${extFromUrl(s.photoUrl, "jpg")}`,
        });
      }
      if (s.videoUrl) {
        downloadFiles.push({
          url: s.videoUrl,
          filename: `${namePrefix}_영상.${extFromUrl(s.videoUrl, "mp4")}`,
        });
      }
    }
  }

  return (
    <main className="mx-auto max-w-[1600px] space-y-8 p-4">
      <h1 className="text-xl font-bold">팀</h1>

      {/* 팀/조 세팅 — 조원 이름(참가자가 입력 안 해도 되도록 어드민이 미리 등록)과
          지역 방문 순서를 한 조당 카드 하나에 같이 둔다. 둘 다 행사 시작 전에
          한 번 세팅해두는 항목이라 굳이 나눠둘 필요가 없었음(그룹별 진행·도움
          요청은 반대로 행사 중 계속 들여다보는 항목이라 아래 별도 섹션 유지). */}
      <section>
        <h2 className="mb-2 text-sm font-bold text-zinc-500">팀 / 조 세팅</h2>
        <ul className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {teams.flatMap((t) =>
            t.groups.map((g) => (
              <li
                key={g.id}
                className="space-y-2 rounded border border-zinc-200 p-2 text-sm"
              >
                <p className="font-semibold">{g.displayName}</p>
                <form
                  action={updateGroupMembers}
                  className="flex flex-wrap items-center gap-1"
                >
                  <input type="hidden" name="id" value={g.id} />
                  <input
                    name="memberName1"
                    defaultValue={g.memberName1 ?? ""}
                    placeholder="조원1 이름"
                    className="min-w-0 flex-1 rounded border border-zinc-300 p-1 text-xs"
                  />
                  <input
                    name="memberName2"
                    defaultValue={g.memberName2 ?? ""}
                    placeholder="조원2 이름"
                    className="min-w-0 flex-1 rounded border border-zinc-300 p-1 text-xs"
                  />
                  <button className="rounded bg-zinc-900 px-2 py-1 text-[10px] text-white">
                    저장
                  </button>
                </form>
                <form
                  action={setGroupRegionOrder}
                  className="flex flex-wrap items-center gap-1 border-t border-zinc-100 pt-2"
                >
                  <input type="hidden" name="groupId" value={g.id} />
                  <span className="shrink-0 text-[10px] text-zinc-500">순서</span>
                  {[0, 1, 2, 3].map((position) => (
                    <select
                      key={position}
                      name="regionOrder"
                      defaultValue={g.regionOrder[position]?.regionId ?? ""}
                      className="rounded border border-zinc-300 p-1 text-xs"
                    >
                      <option value="">-</option>
                      {regions.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  ))}
                  <button
                    type="submit"
                    className="ml-auto rounded bg-zinc-900 px-2 py-1 text-xs text-white"
                  >
                    저장
                  </button>
                </form>
              </li>
            )),
          )}
        </ul>
        <GroupLockToggle locked={settings.groupSelectionLocked} />
      </section>

      {/* 그룹별 진행 */}
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

      {/* 도움 요청 */}
      <section>
        <h2 className="mb-2 text-sm font-bold text-zinc-500">
          도움 요청 — 대기중 ({openHelpRequests.length})
        </h2>
        {openHelpRequests.length === 0 && (
          <p className="text-sm text-zinc-400">열려있는 요청이 없어요.</p>
        )}
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-3">
          {openHelpRequests.map((hr) => (
            <li
              key={hr.id}
              className="flex flex-col gap-3 rounded border border-red-200 bg-red-50 p-4"
            >
              <div className="text-sm">
                <p className="font-semibold">
                  {hr.group.displayName}
                  {hr.requesterName ? ` · ${hr.requesterName}` : ""}
                </p>
                <p className="text-xs text-zinc-500">
                  {hr.location
                    ? `${hr.location.region.name}지역 · ${hr.location.name}`
                    : "장소 지정 없음"}{" "}
                  · {new Date(hr.createdAt).toLocaleTimeString("ko-KR")}
                </p>
                {hr.message && (
                  <p className="mt-2 rounded border border-red-100 bg-white p-3 text-base leading-snug text-zinc-800">
                    {hr.message}
                  </p>
                )}
              </div>
              <form action={resolveHelpRequest} className="self-end">
                <input type="hidden" name="id" value={hr.id} />
                <button className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white">
                  해결됨
                </button>
              </form>
            </li>
          ))}
        </ul>

        {resolvedHelpRequests.length > 0 && (
          <>
            <h3 className="mb-2 mt-4 text-sm font-bold text-zinc-500">
              최근 처리됨
            </h3>
            <ul className="space-y-1">
              {resolvedHelpRequests.map((hr) => (
                <li key={hr.id} className="text-xs text-zinc-400">
                  {hr.group.displayName}
                  {hr.requesterName ? ` · ${hr.requesterName}` : ""} ·{" "}
                  {hr.location
                    ? `${hr.location.region.name}지역 · ${hr.location.name}`
                    : "장소 지정 없음"}
                  {hr.message ? ` · "${hr.message}"` : ""}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* 포인트별 현황 */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-500">포인트별 현황</h2>
          <div className="flex items-center gap-2">
            <BulkDownloadButton files={downloadFiles} />
            <form action={resetAllSubmissions}>
              <ConfirmDeleteButton
                label="전체 초기화"
                className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-600"
                confirmText="모든 그룹의 모든 제출(사진/영상/정답/지급 확정 기록)과 도움 요청 기록을 전부 지우고 포인트 캡도 전부 되돌릴까요?\n답사/리허설 데이터를 한 번에 정리할 때만 쓰세요 — 되돌릴 수 없습니다. (참가자 이름은 각자 기기 쿠키에 있어서 여기선 안 지워집니다 — 테스트에 쓴 기기는 지도 화면의 '그룹 변경'으로 따로 초기화하세요.)"
              />
            </form>
          </div>
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
                  {loc.submissions.map((s) => {
                    const mission =
                      s.missionSlot === 2 ? loc.mission2 : loc.mission1;
                    const namePrefix = safeFilenamePart(
                      `${loc.region.name}_${loc.name}_${s.group.displayName}${s.missionSlot ? `_슬롯${s.missionSlot}` : ""}`,
                    );
                    return (
                    <div
                      key={s.id}
                      className="rounded border border-zinc-200 bg-white p-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-zinc-700">
                          {s.group.displayName}
                          {s.missionSlot && (
                            <span className="ml-1 text-[10px] font-normal text-zinc-400">
                              슬롯{s.missionSlot}
                              {mission ? ` · ${MISSION_LABEL[mission.type] ?? mission.type}` : ""}
                            </span>
                          )}
                        </span>
                        {s.grantStatus === "CONFIRMED" ? (
                          <span className="text-[10px] font-medium text-green-600">
                            지급 확정됨
                          </span>
                        ) : (
                          <form action={confirmGrant}>
                            <input type="hidden" name="id" value={s.id} />
                            <button className="rounded bg-zinc-900 px-2 py-1 text-[10px] text-white">
                              지급 확정
                            </button>
                          </form>
                        )}
                      </div>

                      <div className="mt-1 flex items-start gap-2">
                        {s.photoUrl && (
                          <div className="shrink-0 space-y-0.5">
                            <a href={s.photoUrl} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={s.photoUrl}
                                alt=""
                                className="h-14 w-14 rounded object-cover"
                              />
                            </a>
                            <DownloadLink
                              url={s.photoUrl}
                              filename={`${namePrefix}_사진.${extFromUrl(s.photoUrl, "jpg")}`}
                              label="사진 받기"
                            />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          {s.videoUrl ? (
                            <>
                              <video
                                src={s.videoUrl}
                                controls
                                className="w-full rounded"
                              />
                              <DownloadLink
                                url={s.videoUrl}
                                filename={`${namePrefix}_영상.${extFromUrl(s.videoUrl, "mp4")}`}
                                label="영상 받기"
                              />
                            </>
                          ) : (
                            <p className="text-zinc-400">영상 대기</p>
                          )}
                        </div>
                      </div>

                      <form action={resetSubmission} className="mt-1">
                        <input type="hidden" name="id" value={s.id} />
                        <ConfirmDeleteButton
                          label="초기화"
                          confirmText={`${s.group.displayName}의 "${loc.region.name}지역 · ${loc.name}" 제출을 초기화할까요?\n지급 확정 기록도 함께 사라지고, 캡이 되돌아가서 다시 시도할 수 있게 됩니다.`}
                        />
                      </form>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
