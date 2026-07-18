"use client";

import { useState } from "react";

export function HelpButton() {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  async function handleClick() {
    if (state !== "idle") return;
    setState("sending");
    try {
      await fetch("/api/help-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: null }),
      });
      setState("sent");
      setTimeout(() => setState("idle"), 3000);
    } catch {
      setState("idle");
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={state !== "idle"}
      className="label-tech fixed top-3 left-1/2 z-[60] -translate-x-1/2 rounded-full border-2 border-ink bg-red-600 px-2.5 py-1.5 text-[9px] font-bold whitespace-nowrap text-white shadow-lg disabled:opacity-70"
    >
      {state === "sent" ? "요청 완료!" : state === "sending" ? "요청 중..." : "🆘 도움 요청"}
    </button>
  );
}
