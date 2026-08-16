import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";

// 브라우저가 서명된 URL로 Storage에 직접 업로드한 뒤, 그 경로를 공개 URL로
// 바꿔서 DB에 저장할 때 쓴다.
export function publicPhotoUrl(path: string) {
  return supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(path).data
    .publicUrl;
}
