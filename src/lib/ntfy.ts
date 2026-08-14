// 도움 요청 알림 — ntfy.sh로 푸시. 카카오 "나에게 보내기"는 알림/소리가 안 뜨는
// 메모장 용도라 목적(돌아다니는 중에도 알림 받기)에 안 맞아서 이쪽으로 교체함
// (src/lib/kakao.ts, /api/kakao/callback — 이제 안 씀, 삭제됨).
//
// 계정/승인 절차 없이 그냥 https://ntfy.sh 로 POST만 하면 그 토픽을 구독 중인
// 기기(ntfy 앱)에 진짜 네이티브 푸시가 간다. 토픽 이름 자체가 추측 어려운
// 문자열이면 사실상 비밀번호 역할. 헤더(Title 등)로 한글을 보내면 HTTP 헤더가
// ASCII만 지원해서 퍼센트 인코딩된 채로 깨져 도착한다 — JSON 발행 방식을 쓰면
// 본문에 UTF-8을 그대로 넣을 수 있어 문제없다.
export async function sendNtfyNotification(title: string, message: string): Promise<void> {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return;

  try {
    const res = await fetch("https://ntfy.sh/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        title,
        message,
        priority: 5,
        tags: ["sos"],
      }),
    });
    if (!res.ok) {
      console.error("[ntfy] non-ok response", res.status, await res.text());
    }
  } catch (err) {
    console.error("[ntfy] failed", err);
    // 알림은 어디까지나 보조 수단 — 실패해도 도움 요청 저장 자체는 이미 끝난 뒤라 무시.
  }
}
