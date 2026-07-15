import { createClient } from "@supabase/supabase-js";

// service_role 키 사용 — 서버 코드에서만 import할 것 (클라이언트 번들에 노출 금지)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

export const STORAGE_BUCKET = "borderless";
