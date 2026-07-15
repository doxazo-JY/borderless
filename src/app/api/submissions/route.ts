import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentGroup } from "@/lib/group";
import { getCurrentTargetRegionId } from "@/lib/region-progress";
import { uploadPhoto } from "@/lib/storage";
import { judgePhotoMatch } from "@/lib/judge";

export async function POST(request: Request) {
  const group = await getCurrentGroup();
  if (!group) {
    return NextResponse.json({ result: "no_group" }, { status: 401 });
  }

  const formData = await request.formData();
  const locationId = formData.get("locationId");
  const photo = formData.get("photo");

  if (typeof locationId !== "string" || !(photo instanceof File)) {
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

  // 2. 캡 확인 (AI 호출 전에 먼저) — 마감이면 사진 업로드/판정 자체를 생략
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

  // 3. AI 판정
  const photoUrl = await uploadPhoto(photo, `submissions/${group.id}`);
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
      message: judgement.reason || "사진이 기준과 일치하지 않아요. 다시 촬영해보세요.",
    });
  }

  // 4. 통과 시 캡 원자적 차감 (조건부 UPDATE)
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

  await prisma.submission.create({
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
    mission: location.mission
      ? { type: location.mission.type, content: location.mission.content }
      : null,
  });
}
