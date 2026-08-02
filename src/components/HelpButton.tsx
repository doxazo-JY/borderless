"use client";

import { useState } from "react";

export function HelpButton() {
  const [state, setState] = useState<
    "idle" | "composing" | "sending" | "sent" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  async function handleSend() {
    setState("sending");
    try {
      // MapScreen이 지금 열려있는 포인트 id를 body에 흘려둔다(있으면) — 이게 있어야
      // 임원 화면에서 "통과 처리" 버튼이 뜬다(장소가 없는 요청은 통과 처리 불가).
      const locationId = document.body.dataset.currentLocationId || null;
      const res = await fetch("/api/help-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, message }),
      });
      // fetch는 401/500 같은 응답에서도 예외를 안 던지니 상태 코드를 직접 확인해야
      // 실패를 성공으로 잘못 표시하지 않는다.
      if (!res.ok) throw new Error("request failed");
      setState("sent");
      setMessage("");
      setTimeout(() => setState("idle"), 3000);
    } catch {
      setState("error");
    }
  }

  if (
    state === "composing" ||
    state === "sending" ||
    state === "error"
  ) {
    return (
      <div
        style={{ top: "var(--help-button-top, 12px)" }}
        className="fixed left-1/2 z-[60] w-[min(90vw,320px)] -translate-x-1/2 rounded-xl border-2 border-ink bg-paper-panel p-3 shadow-lg"
      >
        <p className="label-tech mb-1 text-[10px] text-accent">도움 요청</p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="무슨 문제인지 적어주세요 (선택)"
          rows={2}
          autoFocus
          disabled={state === "sending"}
          className="w-full resize-none rounded border border-line p-1.5 text-xs text-ink"
        />
        {state === "error" && (
          <p className="mt-1 text-[10px] font-medium text-red-600">
            전송 실패 — 다시 시도해주세요.
          </p>
        )}
        <div className="mt-2 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setState("idle");
              setMessage("");
            }}
            disabled={state === "sending"}
            className="text-[10px] text-muted underline underline-offset-2"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={state === "sending"}
            className="rounded-full bg-red-600 px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-70"
          >
            {state === "sending" ? "요청 중..." : "요청 보내기"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setState("composing")}
      style={{ top: "var(--help-button-top, 12px)" }}
      className="label-tech fixed left-1/2 z-[60] -translate-x-1/2 rounded-full border-2 border-ink bg-red-600 px-2.5 py-1.5 text-[9px] font-bold whitespace-nowrap text-white shadow-lg"
    >
      {state === "sent" ? "요청 완료!" : "🆘 도움 요청"}
    </button>
  );
}
