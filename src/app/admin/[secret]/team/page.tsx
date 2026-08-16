import { prisma } from "@/lib/prisma";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import { HelpRequestAlert } from "@/components/admin/HelpRequestAlert";
import { GroupLockToggle } from "@/components/admin/GroupLockToggle";
import { AiJudgingToggle } from "@/components/admin/AiJudgingToggle";
import { DownloadLink } from "@/components/admin/DownloadLink";
import { BulkDownloadButton, type DownloadFile } from "@/components/admin/BulkDownloadButton";
import { getAppSettings } from "@/lib/settings";
import {
  acknowledgeHelpRequest,
  confirmGrant,
  failHelpRequest,
  manualPassSubmission,
  manualRejectSubmission,
  passHelpRequest,
  replyHelpRequest,
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
          // 통과한 것만이 아니라 실패/판정대기(AI 오류·중단으로 aiPassed가 null인)
          // 시도도 전부 보여줘서 임원이 도움 요청 없이도 아무 제출이나 리뷰할 수
          // 있게 한다. 캡이 꽉 차서 사진도 없이 자동 생성되는 CLOSED 더미 행만 제외.
          submissions: {
            where: { NOT: { capStatus: "CLOSED", aiPassed: null } },
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

  // 도움 요청 카드에서 임원이 판단할 수 있게, 그 조가 그 포인트에서 마지막으로
  // 시도한 제출(통과 여부 상관없이 — AI가 막혀서 aiPassed가 null인 것도 포함)을
  // 같이 보여준다. 열린 요청 개수가 적어서 요청당 조회 하나씩 병렬로 돌려도 무리 없음.
  const lastAttemptByHelpRequestId = new Map(
    (
      await Promise.all(
        openHelpRequests
          .filter((hr) => hr.locationId)
          .map(async (hr) => {
            const submission = await prisma.submission.findFirst({
              where: { groupId: hr.groupId, locationId: hr.locationId! },
              orderBy: { createdAt: "desc" },
            });
            return [hr.id, submission] as const;
          }),
      )
    ).filter((entry): entry is [string, NonNullable<(typeof entry)[1]>] => !!entry[1]),
  );

  // "전체 zip 다운로드"용 파일 목록 — 통과한 제출만 대상으로 한다(실패/대기중
  // 사진까지 섞이면 결산 영상용 zip의 의미가 달라짐). loc.submissions 자체는
  // 아래 리뷰 UI를 위해 실패/대기중 것도 포함하도록 넓혀뒀으니 여기서 걸러낸다.
  const downloadFiles: DownloadFile[] = [];
  for (const loc of locations) {
    for (const s of loc.submissions) {
      if (s.aiPassed !== true) continue;
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
      <HelpRequestAlert openRequestIds={openHelpRequests.map((hr) => hr.id)} />
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
        <div className="flex flex-col gap-2 sm:flex-row">
          <GroupLockToggle locked={settings.groupSelectionLocked} />
          <AiJudgingToggle disabled={settings.aiJudgingDisabled} />
        </div>
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
          {openHelpRequests.map((hr) => {
            const lastAttempt = lastAttemptByHelpRequestId.get(hr.id);
            return (
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
                  {hr.acknowledgedAt && (
                    <span className="ml-1 font-medium text-emerald-600">
                      · 확인함 {new Date(hr.acknowledgedAt).toLocaleTimeString("ko-KR")}
                    </span>
                  )}
                </p>
                {hr.message && (
                  <p className="mt-2 rounded border border-red-100 bg-white p-3 text-base leading-snug text-zinc-800">
                    {hr.message}
                  </p>
                )}
                {hr.adminMessage && (
                  <p className="mt-2 rounded border border-emerald-100 bg-emerald-50 p-3 text-sm leading-snug text-emerald-800">
                    <span className="font-semibold">내가 보낸 답장: </span>
                    {hr.adminMessage}
                  </p>
                )}
              </div>

              {hr.location && (
                <div className="rounded border border-red-100 bg-white p-2">
                  <p className="mb-1 text-[10px] font-semibold text-zinc-500">
                    마지막 제출 시도
                  </p>
                  {lastAttempt ? (
                    <div className="flex items-start gap-2">
                      {lastAttempt.photoUrl && (
                        <a href={lastAttempt.photoUrl} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={lastAttempt.photoUrl}
                            alt=""
                            className="h-16 w-16 shrink-0 rounded object-cover"
                          />
                        </a>
                      )}
                      <p className="text-xs text-zinc-600">
                        {lastAttempt.aiPassed === false
                          ? `AI 실패: ${lastAttempt.aiReason || "사유 없음"}`
                          : lastAttempt.aiPassed === null
                            ? "AI 판정 오류로 자동 판정 못 함 (사진은 있음)"
                            : "이미 통과 처리됨"}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-400">
                      아직 제출 기록 없음 — 조가 사진을 안 올렸거나 업로드 자체가 실패했을 수 있어요.
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {!hr.acknowledgedAt && (
                  <form action={acknowledgeHelpRequest}>
                    <input type="hidden" name="id" value={hr.id} />
                    <button className="rounded border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700">
                      확인함 (참가자에게 알림)
                    </button>
                  </form>
                )}
                {hr.location && (
                  <form action={passHelpRequest}>
                    <input type="hidden" name="helpRequestId" value={hr.id} />
                    <ConfirmDeleteButton
                      label="통과 처리"
                      className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white"
                      confirmText={`${hr.group.displayName}를 "${hr.location.name}"에서 통과 처리할까요? 캡 차감/미션 공개까지 실제 통과와 동일하게 처리됩니다.`}
                    />
                  </form>
                )}
                <form action={resolveHelpRequest}>
                  <input type="hidden" name="id" value={hr.id} />
                  <button className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white">
                    해결됨 (통과 안 시킴)
                  </button>
                </form>
              </div>

              <form
                action={replyHelpRequest}
                className="flex items-center gap-1 border-t border-red-100 pt-2"
              >
                <input type="hidden" name="id" value={hr.id} />
                <input
                  name="message"
                  required
                  placeholder="답장 보내기 (조에게 그대로 보여요, 확인 처리도 같이 됨)"
                  className="min-w-0 flex-1 rounded border border-zinc-300 p-1 text-xs"
                />
                <button className="shrink-0 rounded border border-emerald-300 bg-white px-2 py-1 text-xs font-medium text-emerald-700">
                  보내기
                </button>
              </form>

              {hr.location && (
                <form
                  action={failHelpRequest}
                  className="flex items-center gap-1 border-t border-red-100 pt-2"
                >
                  <input type="hidden" name="helpRequestId" value={hr.id} />
                  <input
                    name="reason"
                    required
                    placeholder="반려 사유 (조에게 그대로 보여요)"
                    className="min-w-0 flex-1 rounded border border-zinc-300 p-1 text-xs"
                  />
                  <button className="shrink-0 rounded border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-600">
                    반려
                  </button>
                </form>
              )}
            </li>
            );
          })}
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
                <p className="mt-2 text-zinc-400">아직 제출 없음</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {loc.submissions.map((s) => {
                    const mission =
                      s.missionSlot === 2 ? loc.mission2 : loc.mission1;
                    const namePrefix = safeFilenamePart(
                      `${loc.region.name}_${loc.name}_${s.group.displayName}${s.missionSlot ? `_슬롯${s.missionSlot}` : ""}`,
                    );
                    const passed = s.aiPassed === true;
                    const pending = s.aiPassed === null;
                    return (
                    <div
                      key={s.id}
                      className={`rounded border p-2 ${
                        passed
                          ? "border-zinc-200 bg-white"
                          : pending
                            ? "border-amber-300 bg-amber-50"
                            : "border-red-200 bg-red-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-zinc-700">
                          {s.group.displayName}
                          {passed && s.missionSlot && (
                            <span className="ml-1 text-[10px] font-normal text-zinc-400">
                              슬롯{s.missionSlot}
                              {mission ? ` · ${MISSION_LABEL[mission.type] ?? mission.type}` : ""}
                            </span>
                          )}
                        </span>
                        {passed ? (
                          s.grantStatus === "CONFIRMED" ? (
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
                          )
                        ) : (
                          <span
                            className={`text-[10px] font-medium ${pending ? "text-amber-600" : "text-red-600"}`}
                          >
                            {pending ? "판정 대기중" : "AI 실패"}
                          </span>
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
                          {passed ? (
                            s.videoUrl ? (
                              <>
                                {/* 세로로 찍힌 영상이 카드를 과도하게 길게 늘리지 않도록
                                    높이를 제한 — 전체 화면으로 보려면 갤러리 탭으로. */}
                                <video
                                  src={s.videoUrl}
                                  controls
                                  className="max-h-28 w-full rounded object-contain"
                                />
                                <DownloadLink
                                  url={s.videoUrl}
                                  filename={`${namePrefix}_영상.${extFromUrl(s.videoUrl, "mp4")}`}
                                  label="영상 받기"
                                />
                              </>
                            ) : (
                              <p className="text-zinc-400">영상 대기</p>
                            )
                          ) : (
                            <p className="text-zinc-600">
                              {s.aiReason ||
                                (pending
                                  ? "AI 판정을 사용할 수 없어 대기 중이에요."
                                  : "사유 없음")}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* 실패/대기중 제출은 도움 요청 없이도 여기서 바로 통과 처리하거나
                          (대기중일 때만) 사유를 남겨 반려할 수 있다 — AI가 잘못 판단했을
                          가능성까지 임원이 언제든 개입할 수 있어야 한다는 요구로 추가. */}
                      {!passed && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-2">
                          <form action={manualPassSubmission}>
                            <input type="hidden" name="submissionId" value={s.id} />
                            <ConfirmDeleteButton
                              label="통과 처리"
                              className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-medium text-white"
                              confirmText={`${s.group.displayName}를 "${loc.name}"에서 통과 처리할까요? 캡 차감/미션 공개까지 실제 통과와 동일하게 처리됩니다.`}
                            />
                          </form>
                          {pending && (
                            <form
                              action={manualRejectSubmission}
                              className="flex min-w-0 flex-1 items-center gap-1"
                            >
                              <input type="hidden" name="submissionId" value={s.id} />
                              <input
                                name="reason"
                                required
                                placeholder="반려 사유 (조에게 그대로 보여요)"
                                className="min-w-0 flex-1 rounded border border-zinc-300 p-1 text-[10px]"
                              />
                              <button className="shrink-0 rounded border border-red-300 bg-white px-2 py-1 text-[10px] font-medium text-red-600">
                                반려
                              </button>
                            </form>
                          )}
                        </div>
                      )}

                      <form
                        action={resetSubmission}
                        className="mt-2 border-t border-zinc-200 pt-2"
                      >
                        <input type="hidden" name="id" value={s.id} />
                        <ConfirmDeleteButton
                          label="제출 초기화"
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
