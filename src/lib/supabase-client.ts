import { createClient } from "@supabase/supabase-js";

// anon 키 사용 — 브라우저에 노출돼도 안전 (RLS/서명된 URL 토큰이 실제 권한을 담당)
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
