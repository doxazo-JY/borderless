"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { GROUP_COOKIE } from "@/lib/group";
import { getAppSettings } from "@/lib/settings";

export async function selectGroup(formData: FormData) {
  const groupId = formData.get("groupId");
  if (typeof groupId !== "string" || !groupId) {
    throw new Error("groupId가 필요합니다");
  }

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    throw new Error("존재하지 않는 그룹입니다");
  }

  const cookieStore = await cookies();
  const existingGroupId = cookieStore.get(GROUP_COOKIE)?.value;

  // 이미 다른 그룹으로 선택된 상태에서 잠긴 뒤라면 변경 불가 — 처음 선택하는
  // 경우(쿠키 없음)는 잠금 이후에도 허용한다(늦게 합류하는 기기 대비). URL 직접
  // 조작 등으로 여기에 걸리면 에러 화면 대신 조용히 원래 그룹의 지도로 돌려보낸다.
  if (existingGroupId && existingGroupId !== groupId) {
    const settings = await getAppSettings();
    if (settings.groupSelectionLocked) {
      redirect("/map");
    }
  }

  cookieStore.set(GROUP_COOKIE, groupId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7일
  });

  redirect("/map");
}

export async function clearGroup() {
  const cookieStore = await cookies();
  const existingGroupId = cookieStore.get(GROUP_COOKIE)?.value;

  if (existingGroupId) {
    const settings = await getAppSettings();
    if (settings.groupSelectionLocked) {
      // 잠긴 상태에선 UI에서 버튼 자체를 숨기지만, URL 직접 조작 등에 대비해
      // 서버에서도 한 번 더 막는다 — 쿠키는 그대로 두고 지도로 돌려보낸다.
      redirect("/map");
    }
  }

  cookieStore.delete(GROUP_COOKIE);
  redirect("/");
}
