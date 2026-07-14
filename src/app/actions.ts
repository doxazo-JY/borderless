"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { GROUP_COOKIE } from "@/lib/group";

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
  cookieStore.delete(GROUP_COOKIE);
  redirect("/");
}
