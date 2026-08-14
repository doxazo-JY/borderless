import { NextResponse } from "next/server";

// 카카오 로그인 인증 코드 → 토큰 교환. 딱 한 번, 사람이 직접 로그인해서
// refresh_token을 받아오는 용도의 일회성 설정 라우트다(참가자/임원 화면과
// 무관 — 개발자 본인만 씀). 아래 authorize URL로 접속해서 로그인하면
// 카카오가 이 라우트로 ?code=... 를 붙여서 돌려보내고, 여기서 그 code를
// access_token/refresh_token으로 바꿔 화면에 그대로 보여준다.
// refresh_token을 복사해서 KAKAO_REFRESH_TOKEN 환경변수에 넣으면 끝 —
// 어디에도 저장 안 하고 화면에 한 번 보여주기만 한다.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json(
      { ok: false, message: "code 파라미터가 없어요." },
      { status: 400 },
    );
  }

  const restApiKey = process.env.KAKAO_REST_API_KEY;
  if (!restApiKey) {
    return NextResponse.json(
      { ok: false, message: "KAKAO_REST_API_KEY 환경변수가 없어요." },
      { status: 500 },
    );
  }

  const redirectUri = `${url.origin}/api/kakao/callback`;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: restApiKey,
    redirect_uri: redirectUri,
    code,
  });
  if (process.env.KAKAO_CLIENT_SECRET) {
    body.set("client_secret", process.env.KAKAO_CLIENT_SECRET);
  }

  const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tokenData = await tokenRes.json();

  if (!tokenRes.ok) {
    return NextResponse.json({ ok: false, tokenData }, { status: 400 });
  }

  const html = `<!doctype html><html><body style="font-family: sans-serif; padding: 24px; line-height: 1.6;">
    <h1>카카오 토큰 발급 완료</h1>
    <p>아래 refresh_token을 복사해서 <code>KAKAO_REFRESH_TOKEN</code> 환경변수에 넣어주세요.
    (로컬 .env / Vercel 환경변수 둘 다) 이 값은 여기서만 보여주고 어디에도 저장하지 않아요.</p>
    <p><strong>refresh_token</strong></p>
    <textarea readonly style="width:100%;height:80px;">${tokenData.refresh_token ?? ""}</textarea>
    <p><strong>access_token</strong> (참고용 — 몇 시간 뒤 만료되니 저장할 필요 없음)</p>
    <textarea readonly style="width:100%;height:80px;">${tokenData.access_token ?? ""}</textarea>
  </body></html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
