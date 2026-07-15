import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";

export async function uploadPhoto(file: File, pathPrefix: string) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${pathPrefix}/${crypto.randomUUID()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(path, arrayBuffer, {
      contentType: file.type || "image/jpeg",
    });
  if (error) throw error;

  const { data } = supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(path);
  return data.publicUrl;
}
