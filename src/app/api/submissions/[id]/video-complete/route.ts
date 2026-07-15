import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentGroup } from "@/lib/group";
import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const group = await getCurrentGroup();
  if (!group) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { id } = await params;
  const submission = await prisma.submission.findUnique({ where: { id } });
  if (!submission || submission.groupId !== group.id) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const path = typeof body?.path === "string" ? body.path : null;
  if (!path) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { data } = supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(path);

  await prisma.submission.update({
    where: { id: submission.id },
    data: { videoUrl: data.publicUrl },
  });

  return NextResponse.json({ ok: true, videoUrl: data.publicUrl });
}
