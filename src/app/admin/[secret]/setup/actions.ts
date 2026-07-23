"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { uploadPhoto } from "@/lib/storage";

const SETUP_PATH = `/admin/${process.env.ADMIN_SECRET_PATH}/setup`;

function refresh() {
  revalidatePath(SETUP_PATH);
}

export async function createLocation(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const regionId = String(formData.get("regionId") ?? "");
  const lat = parseFloat(String(formData.get("lat") ?? ""));
  const lng = parseFloat(String(formData.get("lng") ?? ""));
  const address = String(formData.get("address") ?? "").trim() || null;
  const judgePromptRaw = String(formData.get("judgePrompt") ?? "").trim();
  const missionId = String(formData.get("missionId") ?? "") || null;
  const ingredientIds = formData.getAll("ingredientIds").map(String);
  const photo = formData.get("referencePhoto");

  if (!name || !regionId || Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new Error("이름, 지역, 좌표는 필수입니다.");
  }

  let referencePhotoUrl: string | undefined;
  if (photo instanceof File && photo.size > 0) {
    referencePhotoUrl = await uploadPhoto(photo, "reference");
  }

  await prisma.location.create({
    data: {
      name,
      regionId,
      lat,
      lng,
      address,
      ...(judgePromptRaw ? { judgePrompt: judgePromptRaw } : {}),
      missionId,
      referencePhotoUrl,
      ingredients: { connect: ingredientIds.map((id) => ({ id })) },
    },
  });

  refresh();
}

export async function updateLocationPhoto(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const photo = formData.get("referencePhoto");
  if (!id || !(photo instanceof File) || photo.size === 0) return;

  const referencePhotoUrl = await uploadPhoto(photo, "reference");
  await prisma.location.update({ where: { id }, data: { referencePhotoUrl } });

  refresh();
}

export async function updateLocationDetails(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const name = String(formData.get("name") ?? "").trim();
  const missionId = String(formData.get("missionId") ?? "") || null;
  const ingredientIds = formData.getAll("ingredientIds").map(String);
  const judgePrompt = String(formData.get("judgePrompt") ?? "").trim();

  await prisma.location.update({
    where: { id },
    data: {
      missionId,
      ingredients: { set: ingredientIds.map((ingId) => ({ id: ingId })) },
      ...(name ? { name } : {}),
      ...(judgePrompt ? { judgePrompt } : {}),
    },
  });

  refresh();
}

export async function deleteLocation(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  // Submission/HelpRequest는 이 location을 RESTRICT로 참조하므로, 이미 제출 기록이
  // 있는 포인트를 지우면 FK 위반으로 서버 에러가 났다 — 관련 기록도 함께 정리한다.
  await prisma.$transaction([
    prisma.helpRequest.deleteMany({ where: { locationId: id } }),
    prisma.submission.deleteMany({ where: { locationId: id } }),
    prisma.location.delete({ where: { id } }),
  ]);
  refresh();
}

export async function toggleLocationActive(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const isActive = formData.get("isActive") === "true";
  if (!id) return;

  await prisma.location.update({ where: { id }, data: { isActive } });
  refresh();
}

const MISSION_TYPES = ["WORD", "PRAISE", "PRAYER", "PUZZLE"] as const;

export async function createMission(formData: FormData) {
  const type = String(formData.get("type") ?? "");
  const content = String(formData.get("content") ?? "").trim();
  const answer = String(formData.get("answer") ?? "").trim() || null;
  if (!MISSION_TYPES.includes(type as (typeof MISSION_TYPES)[number])) {
    throw new Error("잘못된 미션 유형입니다.");
  }

  let imageUrl: string | null = null;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    imageUrl = await uploadPhoto(photo, "mission");
  }

  await prisma.mission.create({
    data: {
      type: type as (typeof MISSION_TYPES)[number],
      content,
      answer,
      imageUrl,
    },
  });
  refresh();
}

export async function updateMissionPhoto(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const photo = formData.get("photo");
  if (!id || !(photo instanceof File) || photo.size === 0) return;

  const imageUrl = await uploadPhoto(photo, "mission");
  await prisma.mission.update({ where: { id }, data: { imageUrl } });

  refresh();
}

export async function deleteMission(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.mission.delete({ where: { id } });
  refresh();
}

export async function updateMission(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const type = String(formData.get("type") ?? "");
  const content = String(formData.get("content") ?? "").trim();
  const answer = String(formData.get("answer") ?? "").trim() || null;
  if (!id) return;
  if (!MISSION_TYPES.includes(type as (typeof MISSION_TYPES)[number])) {
    throw new Error("잘못된 미션 유형입니다.");
  }
  await prisma.mission.update({
    where: { id },
    data: { type: type as (typeof MISSION_TYPES)[number], content, answer },
  });
  refresh();
}

export async function createIngredient(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    throw new Error("이름은 필수입니다.");
  }

  await prisma.ingredient.create({
    data: { name },
  });
  refresh();
}

export async function deleteIngredient(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.ingredient.delete({ where: { id } });
  refresh();
}
