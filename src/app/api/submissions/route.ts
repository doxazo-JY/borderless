import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentGroup } from "@/lib/group";
import { getCurrentTargetRegionId } from "@/lib/region-progress";
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
    include: { region: true, mission: true },
  });
  if (!location) {
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
      location: { regionId: location.regionId },
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
      message: "이미 마감된 포인트예요. 같은 지역의 다른 포인트로 가보세요.",
    });
  }

  // 4. AI 판정
  const { data: photoUrlData } = supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(photoPath);
  const photoUrl = photoUrlData.publicUrl;
  const judgement = await judgePhotoMatch({
    referencePhotoUrl: location.referencePhotoUrl,
    uploadedPhotoUrl: photoUrl,
    judgePrompt: location.judgePrompt,
  });

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
    });
  }

  // 5. 통과 시 캡 원자적 차감 (조건부 UPDATE)
  const updateResult = await prisma.location.updateMany({
    where: { id: location.id, claimedCount: { lt: location.capacity } },
    data: { claimedCount: { increment: 1 } },
  });

  if (updateResult.count === 0) {
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

  const submission = await prisma.submission.create({
    data: {
      groupId: group.id,
      locationId: location.id,
      photoUrl,
      capStatus: "AVAILABLE",
      aiPassed: true,
      aiReason: judgement.reason,
      grantStatus: "PENDING",
    },
  });

  return NextResponse.json({
    result: "passed",
    message: judgement.reason,
    submissionId: submission.id,
    photoUrl,
    mission: location.mission
      ? { type: location.mission.type, content: location.mission.content }
      : null,
  });
}
