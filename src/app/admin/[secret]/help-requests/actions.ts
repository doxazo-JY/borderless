"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function resolveHelpRequest(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const secret = String(formData.get("secret") ?? "");
  if (!id) return;

  await prisma.helpRequest.update({
    where: { id },
    data: { status: "RESOLVED" },
  });

  revalidatePath(`/admin/${secret}/help-requests`);
}
