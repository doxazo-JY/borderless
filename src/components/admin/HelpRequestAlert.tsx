"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/** 대기중인 도움 요청 목록을 주기적으로 새로고침하고, 새 요청(기존에 없던 id)이
 * 생기면 소리+진동으로 알린다. 임원이 현장을 돌아다니면서 미션을 같이 진행하는
 * 중이라 화면을 계속 보고 있지 않을 수 있어서 만들었다.
 *
 * 한계: 브라우저 탭이 열려있고(화면이 꺼져있거나 백그라운드로 가면 폴링 자체가
 * 느려지거나 멈출 수 있음), 이 페이지에서 한 번이라도 탭/클릭을 한 뒤라야 소리가
 * 확실히 난다(브라우저 자동재생 정책). 폰이 잠겨있거나 다른 앱으로 완전히
 * 전환된 상태에서 깨워주는 건 못 한다 — 그러려면 푸시 알림(서비스워커)이 따로
 * 필요해서 이번 범위에는 안 넣었다. */
export function HelpRequestAlert({ openRequestIds }: { openRequestIds: string[] }) {
  const router = useRouter();
  const knownIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(interval);
  }, [router]);

  useEffect(() => {
    const known = knownIdsRef.current;
    const hasNew = known !== null && openRequestIds.some((id) => !known.has(id));
    knownIdsRef.current = new Set(openRequestIds);
    if (!hasNew) return;

    // 짧은 삐- 소리 두 번 — 오디오 파일 없이 Web Audio API로 직접 생성.
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        [0, 0.35].forEach((delay) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = 880;
          const t = ctx.currentTime + delay;
          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
          osc.connect(gain).connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.3);
        });
      }
    } catch {
      // 자동재생 차단 등으로 실패해도 진동은 시도해야 하니 조용히 넘어간다.
    }

    navigator.vibrate?.([200, 100, 200]);
  }, [openRequestIds]);

  return null;
}
