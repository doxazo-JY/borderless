import { config } from "dotenv";
import { existsSync, readFileSync } from "fs";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config();
if (existsSync(".env.local")) {
  const local = parse(readFileSync(".env.local"));
  for (const [key, value] of Object.entries(local)) {
    if (value !== "") process.env[key] = value;
  }
}

const BUCKET = "borderless";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: buckets, error: listError } =
    await supabase.storage.listBuckets();
  if (listError) throw listError;

  if (buckets.some((b) => b.name === BUCKET)) {
    console.log(`버킷 "${BUCKET}" 이미 존재함 — 건너뜀`);
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(
    BUCKET,
    {
      public: true,
      // 미션 영상(10~20초)이 폰 화질에 따라 20MB를 쉽게 넘어서 업로드가 막힌 적
      // 있음 — 지금 Supabase 요금제에서 허용하는 최대치(50MB)로 맞춰둔다.
      fileSizeLimit: "50MB",
    },
  );
  if (createError) throw createError;

  console.log(`버킷 "${BUCKET}" 생성 완료 (public)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
