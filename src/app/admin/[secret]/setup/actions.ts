"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { uploadPhoto } from "@/lib/storage";
import { getAppSettings } from "@/lib/settings";

const SETUP_PATH = `/admin/${process.env.ADMIN_SECRET_PATH}/setup`;

function refresh() {
  revalidatePath(SETUP_PATH);
}

export async function toggleGroupSelectionLock() {
  const settings = await getAppSettings();
  await prisma.appSettings.update({
    where: { id: settings.id },
    data: { groupSelectionLocked: !settings.groupSelectionLocked },
  });
  refresh();
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
  const missionId = String(formData.get("missionId") ?? "") || null;
  const ingredientIds = formData.getAll("ingredientIds").map(String);
  const judgePrompt = String(formData.get("judgePrompt") ?? "").trim();

  await prisma.location.update({
    where: { id },
    data: {
      missionId,
      ingredients: { set: ingredientIds.map((ingId) => ({ id: ingId })) },
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

export async function createMission(formData: FormData) {
  const type = String(formData.get("type") ?? "");
  const content = String(formData.get("content") ?? "").trim();
  if (!["WORD", "PRAISE", "PRAYER"].includes(type)) {
    throw new Error("잘못된 미션 유형입니다.");
  }
  await prisma.mission.create({
    data: { type: type as "WORD" | "PRAISE" | "PRAYER", content },
  });
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
  if (!id) return;
  if (!["WORD", "PRAISE", "PRAYER"].includes(type)) {
    throw new Error("잘못된 미션 유형입니다.");
  }
  await prisma.mission.update({
    where: { id },
    data: { type: type as "WORD" | "PRAISE" | "PRAYER", content },
  });
  refresh();
}

export async function createIngredient(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const variant = String(formData.get("variant") ?? "").trim() || null;
  const isBase = formData.get("isBase") === "on";

  if (!name || !category) {
    throw new Error("이름과 분류는 필수입니다.");
  }

  await prisma.ingredient.create({
    data: { name, category, variant, isBase },
  });
  refresh();
}

export async function deleteIngredient(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.ingredient.delete({ where: { id } });
  refresh();
}

export async function setGroupRegionOrder(formData: FormData) {
  const groupId = String(formData.get("groupId") ?? "");
  const regionIds = formData.getAll("regionOrder").map(String);
  if (!groupId || regionIds.length === 0) return;

  await prisma.$transaction([
    prisma.groupRegionOrder.deleteMany({ where: { groupId } }),
    ...regionIds.map((regionId, position) =>
      prisma.groupRegionOrder.create({
        data: { groupId, regionId, position },
      }),
    ),
  ]);

  refresh();
}
