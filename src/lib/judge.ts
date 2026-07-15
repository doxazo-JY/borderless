import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const MODEL = process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";

export type JudgeResult = { passed: boolean; reason: string };

export async function judgePhotoMatch({
  referencePhotoUrl,
  uploadedPhotoUrl,
  judgePrompt,
}: {
  referencePhotoUrl: string | null;
  uploadedPhotoUrl: string;
  judgePrompt: string;
}): Promise<JudgeResult> {
  if (!referencePhotoUrl) {
    return {
      passed: true,
      reason:
        "이 포인트는 기준 사진이 아직 등록되지 않아 임시로 자동 통과 처리되었습니다 (더미 데이터).",
    };
  }

  const response = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `${judgePrompt}\n\n첫 번째 이미지는 기준 사진이고, 두 번째 이미지는 참가자가 방금 업로드한 사진입니다. 두 사진이 같은 장소/사물을 나타내는지 판단해서 반드시 아래 JSON 형식으로만 답하세요:\n{"passed": true 또는 false, "reason": "판단 이유를 한국어로 한두 문장"}`,
          },
          { type: "image_url", image_url: { url: referencePhotoUrl } },
          { type: "image_url", image_url: { url: uploadedPhotoUrl } },
        ],
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(content);
    return { passed: !!parsed.passed, reason: String(parsed.reason ?? "") };
  } catch {
    return {
      passed: false,
      reason: `판정 응답을 해석하지 못했습니다: ${content.slice(0, 200)}`,
    };
  }
}
