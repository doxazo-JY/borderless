// 카카오톡 "나에게 보내기" — 도움 요청이 새로 들어오면 임원 본인 카카오톡으로
// 알림을 보낸다. 폰이 잠겨있어도(웹푸시와 달리) 카카오톡 자체 푸시로 오니까
// 아이폰에서도 별도 PWA 설치 없이 확실히 온다.
//
// 처음 한 번은 사람이 직접 로그인해서 refresh_token을 받아와야 한다
// (/api/kakao/callback 참고) — 그 이후로는 이 refresh_token으로 계속
// access_token을 재발급받아 쓴다. refresh_token 자체도 만료되긴 하지만
// (기본 60일, 쓸 때마다 연장) 며칠짜리 행사엔 문제없다.

async function getAccessToken(): Promise<string | null> {
  const restApiKey = process.env.KAKAO_REST_API_KEY;
  const refreshToken = process.env.KAKAO_REFRESH_TOKEN;
  if (!restApiKey || !refreshToken) return null;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: restApiKey,
    refresh_token: refreshToken,
  });
  if (process.env.KAKAO_CLIENT_SECRET) {
    body.set("client_secret", process.env.KAKAO_CLIENT_SECRET);
  }

  const res = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token ?? null;
}

/** 실패해도 도움 요청 자체(DB 저장)는 이미 끝난 뒤라 절대 던지지 않는다 —
 * 카카오 알림은 어디까지나 보조 수단이라 이것 때문에 요청 자체가 실패하면 안 됨. */
export async function sendKakaoNotification(text: string): Promise<void> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) return;

    const templateObject = {
      object_type: "text",
      text,
      link: { web_url: "", mobile_web_url: "" },
    };

    await fetch("https://kapi.kakao.com/v2/api/talk/memo/default/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        template_object: JSON.stringify(templateObject),
      }),
    });
  } catch {
    // 조용히 무시 — 위 주석 참고.
  }
}
