import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const GROUP_COOKIE = "groupId";

export async function getCurrentGroup() {
  const cookieStore = await cookies();
  const groupId = cookieStore.get(GROUP_COOKIE)?.value;
  if (!groupId) return null;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { team: true },
  });

  return group;
}
