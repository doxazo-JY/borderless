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
      className="fixed right-4 bottom-4 z-[60] rounded-full bg-red-600 px-4 py-3 text-sm font-bold text-white shadow-lg disabled:opacity-70"
    >
      {state === "sent"
        ? "요청 완료!"
        : state === "sending"
          ? "요청 중..."
          : "임원 도움 요청"}
    </button>
  );
}
