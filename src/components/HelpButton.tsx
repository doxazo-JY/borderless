"use client";

import { useEffect, useState } from "react";
import { FAILURE_TIPS } from "@/lib/failure-tips";

type TrackedRequest = {
  id: string;
  status: "OPEN" | "RESOLVED";
  acknowledged: boolean;
  adminMessage: string | null;
};

export function HelpButton() {
  const [state, setState] = useState<
    "idle" | "composing" | "sending" | "sent" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [showTips, setShowTips] = useState(false);
  // 요청을 보낸 뒤에도 "확인함/해결됨" 상태를 계속 보여주기 위해 위 state와는
  // 별도로 들고 있는다 — state는 작성 폼 자체의 UI 상태고, 이건 이미 보낸
  // 요청의 서버 쪽 진행 상황이라 서로 독립적으로 움직여야 한다.
  const [tracked, setTracked] = useState<TrackedRequest | null>(null);

  // 계속 기다리게만 두지 않고 "확인했다/처리됐다"를 참가자한테도 보여주려고
  // 몇 초 간격으로 상태를 폴링한다. RESOLVED가 되면 더 물어볼 필요 없어서 멈춘다.
  useEffect(() => {
    if (!tracked || tracked.status === "RESOLVED") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/help-requests?id=${tracked.id}`);
        if (!res.ok) return;
        const data = await res.json();
        setTracked((prev) =>
          prev && prev.id === tracked.id
            ? {
                ...prev,
                status: data.status,
                acknowledged: data.acknowledged,
                adminMessage: data.adminMessage,
              }
            : prev,
        );
      } catch {
        // 폴링 실패는 조용히 넘어가고 다음 주기에 다시 시도.
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [tracked]);

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
      const data = await res.json();
      setState("sent");
      setMessage("");
      setTracked({ id: data.id, status: "OPEN", acknowledged: false, adminMessage: null });
      setTimeout(() => setState("idle"), 3000);
    } catch {
      setState("error");
    }
  }

  return (
    <>
      {(state === "composing" || state === "sending" || state === "error") && (
        <div
          style={{ top: "var(--help-button-top, 12px)" }}
          className="fixed left-1/2 z-[60] w-[min(90vw,320px)] -translate-x-1/2 lg:left-[30%] rounded-xl border-2 border-ink bg-paper-panel p-3 shadow-[0_10px_30px_-8px_rgba(20,18,12,0.4)]"
        >
          <p className="label-tech mb-1 text-[10px] text-accent">도움 요청</p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="무슨 문제인지 적어주세요 (선택)"
            rows={2}
            autoFocus
            disabled={state === "sending"}
            // 16px(text-base) 미만이면 아이폰 사파리가 포커스할 때 화면을
            // 자동으로 확대해버린다 — text-xs(12px)였던 게 그 원인이었다.
            className="w-full resize-none rounded border border-line p-1.5 text-base text-ink"
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
      )}

      {showTips && (
        <div
          style={{ top: "var(--help-button-top, 12px)" }}
          className="fixed left-1/2 z-[60] w-[min(90vw,320px)] -translate-x-1/2 lg:left-[30%] rounded-xl border-2 border-ink bg-paper-panel p-3 shadow-[0_10px_30px_-8px_rgba(20,18,12,0.4)]"
        >
          <div className="mb-1 flex items-center justify-between">
            <p className="label-tech text-[10px] text-accent">자주 막히는 이유</p>
            <button
              type="button"
              onClick={() => setShowTips(false)}
              className="text-[10px] text-muted underline underline-offset-2"
            >
              닫기
            </button>
          </div>
          <ul className="list-disc space-y-1 pl-4 text-xs text-ink">
            {FAILURE_TIPS.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      )}

      {state !== "composing" && state !== "sending" && state !== "error" && (
        <div
          style={{ top: "var(--help-button-top, 12px)" }}
          className="fixed left-1/2 z-[60] flex -translate-x-1/2 items-center gap-1.5 lg:left-[30%]"
        >
          <button
            onClick={() => {
              setShowTips(false);
              setState("composing");
            }}
            className="label-tech rounded-full border-2 border-ink bg-red-600 px-2.5 py-1.5 text-[9px] font-bold whitespace-nowrap text-white shadow-[0_6px_18px_-4px_rgba(220,38,38,0.55)]"
          >
            {state === "sent" ? "요청 완료!" : "도움 요청"}
          </button>
          <button
            onClick={() => setShowTips((v) => !v)}
            aria-label="자주 막히는 이유"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-paper-panel text-xs font-bold text-ink shadow-[0_2px_8px_rgba(20,18,12,0.25)]"
          >
            ?
          </button>
        </div>
      )}

      {tracked && <TrackedRequestBanner tracked={tracked} onDismiss={() => setTracked(null)} />}
    </>
  );
}

/** 보낸 도움 요청이 아직 살아있는 동안(해결 전까지) 계속 떠서 진행 상황을
 * 보여주는 배너 — "요청이 가긴 한 건지" 불안해하며 계속 기다리는 걸 줄이려는
 * 목적. SOS 버튼 바로 아래, 같은 가로 위치에 둔다. */
function TrackedRequestBanner({
  tracked,
  onDismiss,
}: {
  tracked: TrackedRequest;
  onDismiss: () => void;
}) {
  const label = tracked.status === "RESOLVED"
    ? "임원이 처리했어요"
    : tracked.acknowledged
      ? "임원이 확인했어요 — 곧 도와드릴게요"
      : "요청을 보냈어요 — 확인을 기다리는 중";

  const tone =
    tracked.status === "RESOLVED"
      ? "border-emerald-600 bg-emerald-50 text-emerald-800"
      : tracked.acknowledged
        ? "border-accent bg-white text-ink"
        : "border-line bg-white text-muted";

  return (
    <>
      <div
        style={{ top: "calc(var(--help-button-top, 12px) + 34px)" }}
        className={`label-tech fixed left-1/2 z-[59] flex -translate-x-1/2 items-center gap-2 rounded-full border-2 px-3 py-1.5 text-[9px] font-bold whitespace-nowrap shadow-[0_6px_14px_-6px_rgba(20,18,12,0.4)] lg:left-[30%] ${tone}`}
      >
        {tracked.status !== "RESOLVED" && (
          <span
            className={`h-1.5 w-1.5 rounded-full ${tracked.acknowledged ? "bg-accent" : "bg-muted"} animate-pulse`}
          />
        )}
        {label}
        <button type="button" onClick={onDismiss} className="ml-1 text-muted">
          ✕
        </button>
      </div>
      {tracked.adminMessage && (
        <div
          style={{ top: "calc(var(--help-button-top, 12px) + 66px)" }}
          className="fixed left-1/2 z-[59] w-[min(90vw,320px)] -translate-x-1/2 rounded-xl border-2 border-accent bg-paper-panel p-3 shadow-[0_10px_30px_-8px_rgba(20,18,12,0.4)] lg:left-[30%]"
        >
          <p className="label-tech mb-1 text-[10px] text-accent">임원 답장</p>
          <p className="text-sm text-ink">{tracked.adminMessage}</p>
        </div>
      )}
    </>
  );
}
