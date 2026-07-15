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

  const formData = await request.formData();
  const video = formData.get("video");
  if (!(video instanceof File)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const ext = video.name.split(".").pop() || "mp4";
  const path = `videos/${group.id}/${submission.id}.${ext}`;
  const arrayBuffer = await video.arrayBuffer();

  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(path, arrayBuffer, {
      contentType: video.type || "video/mp4",
      upsert: true,
    });
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  const { data } = supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(path);

  await prisma.submission.update({
    where: { id: submission.id },
    data: { videoUrl: data.publicUrl },
  });

  return NextResponse.json({ ok: true, videoUrl: data.publicUrl });
}
