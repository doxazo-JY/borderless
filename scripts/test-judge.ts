import { config, parse } from "dotenv";
import { existsSync, readFileSync } from "fs";
import { extname } from "path";

config();
if (existsSync(".env.local")) {
  const local = parse(readFileSync(".env.local"));
  for (const [key, value] of Object.entries(local)) {
    if (value !== "") process.env[key] = value;
  }
}

function toDataUrl(path: string): string {
  const bytes = readFileSync(path);
  const ext = extname(path).toLowerCase().replace(".", "");
  const mime = ext === "jpg" ? "jpeg" : ext; // jpg -> jpeg
  return `data:image/${mime};base64,${bytes.toString("base64")}`;
}

// 사용법: npx tsx scripts/test-judge.ts <기준사진경로> <테스트사진경로> ["판정 프롬프트"]
async function main() {
  const [refPath, testPath, promptArg] = process.argv.slice(2);
  if (!refPath || !testPath) {
    console.error(
      "사용법: npx tsx scripts/test-judge.ts <기준사진경로> <테스트사진경로> [\"판정 프롬프트\"]",
    );
    process.exit(1);
  }

  const judgePrompt =
    promptArg ||
    "기준 사진과 아래 업로드된 사진이 같은 장소 또는 같은 사물을 보여주는지 판단하세요.";

  // 정적 import는 dotenv.config()보다 먼저 평가되므로(ESM 호이스팅), env 세팅 후 동적 import
  const { judgePhotoMatch } = await import("../src/lib/judge");

  const referencePhotoUrl = toDataUrl(refPath);
  const uploadedPhotoUrl = toDataUrl(testPath);

  console.log(`모델: ${process.env.OPENAI_VISION_MODEL || "gpt-4o-mini"}`);
  console.log(`프롬프트: ${judgePrompt}`);
  console.log(`기준 사진: ${refPath}`);
  console.log(`테스트 사진: ${testPath}`);
  console.log("---");

  const start = Date.now();
  const result = await judgePhotoMatch({ referencePhotoUrl, uploadedPhotoUrl, judgePrompt });
  const elapsed = Date.now() - start;

  console.log(`판정: ${result.passed ? "✅ 통과" : "❌ 실패"} (${elapsed}ms)`);
  console.log(`이유: ${result.reason}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
