"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function confirmGrant(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const secret = String(formData.get("secret") ?? "");
  if (!id) return;

  await prisma.submission.update({
    where: { id },
    data: { grantStatus: "CONFIRMED", confirmedAt: new Date() },
  });

  revalidatePath(`/admin/${secret}/grants`);
}
