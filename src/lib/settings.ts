import { prisma } from "@/lib/prisma";

export async function getAppSettings() {
  const existing = await prisma.appSettings.findFirst();
  if (existing) return existing;
  return prisma.appSettings.create({ data: {} });
}
