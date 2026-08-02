import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentGroup } from "@/lib/group";
import { getCurrentTargetRegionId } from "@/lib/region-progress";
import { getAppSettings } from "@/lib/settings";
import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";
import { judgePhotoMatch } from "@/lib/judge";

export async function POST(request: Request) {
  const group = await getCurrentGroup();
  if (!group) {
    return NextResponse.json({ result: "no_group" }, { status: 401 });
  }

  // 사진 바이트는 이미 브라우저가 Supabase Storage로 직접 업로드해뒀고(photo-upload-url
  // 라우트 참고), 여기서는 그 경로만 전달받는다.
  const body = await request.json().catch(() => ({}));
  const locationId = body?.locationId;
  const photoPath = body?.photoPath;

  if (typeof locationId !== "string" || typeof photoPath !== "string") {
    return NextResponse.json({ result: "invalid_request" }, { status: 400 });
  }
  if (!photoPath.startsWith(`submissions/${group.id}/`)) {
    return NextResponse.json({ result: "invalid_request" }, { status: 400 });
  }

  const location = await prisma.location.findUnique({
    where: { id: locationId },
    include: { region: true, mission1: true, mission2: true },
  });
  if (!location || !location.isActive) {
    return NextResponse.json({ result: "not_found" }, { status: 404 });
  }

  // 1. 지역 방문 순서 강제 (지도 UI는 안 막지만 제출은 여기서 막음)
  const targetRegionId = await getCurrentTargetRegionId(group.id);
  if (location.regionId !== targetRegionId) {
    const targetRegion = targetRegionId
      ? await prisma.region.findUnique({ where: { id: targetRegionId } })
      : null;
    return NextResponse.json({
      result: "wrong_region",
      message: targetRegion
        ? `지금은 ${targetRegion.name}지역으로 이동할 차례예요.`
        : "이미 모든 지역을 완료했어요.",
    });
  }

  // 2. 지역당 통과는 한 곳만 — 이 지역의 다른 포인트에서 이미 통과했다면 재판정 없이 안내
  const passedInRegion = await prisma.submission.findFirst({
    where: {
      groupId: group.id,
      aiPassed: true,
      location: { regionId: location.regionId, isActive: true },
    },
    include: { location: true },
  });
  if (passedInRegion && passedInRegion.locationId !== location.id) {
    return NextResponse.json({
      result: "region_done",
      message: `이미 ${location.region.name}지역 "${passedInRegion.location.name}"에서 통과했어요. 그 포인트로 돌아가 미션을 확인해주세요.`,
    });
  }

  // 3. 캡 확인 (AI 호출 전에 먼저) — 마감이면 사진 업로드/판정 자체를 생략
  if (location.claimedCount >= location.capacity) {
    await prisma.submission.create({
      data: {
        groupId: group.id,
        locationId: location.id,
        capStatus: "CLOSED",
        aiPassed: null,
      },
    });
    return NextResponse.json({
      result: "closed",
      message: "이미 마감된 장소입니다. 다른 장소로 이동해주세요.",
    });
  }

  // 4. AI 판정
  const { data: photoUrlData } = supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(photoPath);
  const photoUrl = photoUrlData.publicUrl;

  // 임원이 "AI 판정 중단"으로 표시해뒀으면(크레딧 소진 등을 미리 알고 있는 경우),
  // 어차피 실패할 API를 호출하지 않고 바로 수동 검토 대기 상태로 넘어간다 —
  // 아래 catch 블록과 완전히 같은 모양의 제출을 만들어 임원 화면에서 똑같이 다뤄진다.
  const { aiJudgingDisabled } = await getAppSettings();
  if (aiJudgingDisabled) {
    await prisma.submission.create({
      data: {
        groupId: group.id,
        locationId: location.id,
        photoUrl,
        capStatus: "AVAILABLE",
        aiPassed: null,
      },
    });
    return NextResponse.json({
      result: "ai_error",
      message:
        "지금은 임원이 직접 확인 중이에요. 사진은 저장됐으니 '임원 도움 요청' 버튼을 눌러 확인을 요청해주세요.",
      photoUrl,
    });
  }

  let judgement;
  try {
    judgement = await judgePhotoMatch({
      referencePhotoUrl: location.referencePhotoUrl,
      uploadedPhotoUrl: photoUrl,
      judgePrompt: location.judgePrompt,
    });
  } catch (e) {
    // AI API 자체가 막힌 경우(크레딧 소진/장애 등) — 판정 없이 그냥 에러로 묻히면
    // 제출 기록이 아예 안 남아서 임원이 사진을 볼 방법이 없어진다. aiPassed를
    // null로 남긴 제출을 만들어 사진만이라도 남기고, 임원 도움 요청으로 안내한다.
    console.error("AI 판정 API 호출 실패:", e);
    await prisma.submission.create({
      data: {
        groupId: group.id,
        locationId: location.id,
        photoUrl,
        capStatus: "AVAILABLE",
        aiPassed: null,
      },
    });
    return NextResponse.json({
      result: "ai_error",
      message:
        "지금 AI 판정을 사용할 수 없어요. 사진은 저장됐으니 '임원 도움 요청' 버튼을 눌러 확인을 요청해주세요.",
      photoUrl,
    });
  }

  if (!judgement.passed) {
    await prisma.submission.create({
      data: {
        groupId: group.id,
        locationId: location.id,
        photoUrl,
        capStatus: "AVAILABLE",
        aiPassed: false,
        aiReason: judgement.reason,
      },
    });
    return NextResponse.json({
      result: "failed",
      message: judgement.reason || "사진이 기준과 일치하지 않아요. 다른 사진으로 다시 시도해보세요.",
      photoUrl,
    });
  }

  // 5. 통과 시 캡 원자적 차감 (조건부 UPDATE) — updateMany는 갱신된 행을 반환하지
  // 않아서 "몇 번째로 자리를 차지했는지"(=미션 슬롯 번호)를 알 수 없다. RETURNING으로
  // 새 claimedCount를 같은 원자적 UPDATE 안에서 받아와야 동시 요청 사이에서도
  // 슬롯 번호가 안전하게 결정된다 (capacity가 항상 2라서 새 claimedCount 값이 곧 슬롯 번호).
  const claimed = await prisma.$queryRaw<{ claimedCount: number }[]>`
    UPDATE "Location"
    SET "claimedCount" = "claimedCount" + 1
    WHERE id = ${location.id} AND "claimedCount" < capacity
    RETURNING "claimedCount"
  `;

  if (claimed.length === 0) {
    // 판정 통과했지만 그 사이 다른 그룹이 마지막 자리를 채감
    await prisma.submission.create({
      data: {
        groupId: group.id,
        locationId: location.id,
        photoUrl,
        capStatus: "CLOSED",
        aiPassed: true,
        aiReason: judgement.reason,
      },
    });
    return NextResponse.json({
      result: "closed",
      message: "판정엔 통과했지만 방금 마감됐어요. 같은 지역의 다른 포인트로 가보세요.",
    });
  }

  const missionSlot = claimed[0].claimedCount;
  const mission = missionSlot === 2 ? location.mission2 : location.mission1;

  const submission = await prisma.submission.create({
    data: {
      groupId: group.id,
      locationId: location.id,
      photoUrl,
      capStatus: "AVAILABLE",
      aiPassed: true,
      aiReason: judgement.reason,
      grantStatus: "PENDING",
      missionSlot,
    },
  });

  return NextResponse.json({
    result: "passed",
    message: judgement.reason,
    submissionId: submission.id,
    photoUrl,
    mission: mission
      ? {
          type: mission.type,
          content: mission.content,
          imageUrl: mission.imageUrl,
        }
      : null,
  });
}
