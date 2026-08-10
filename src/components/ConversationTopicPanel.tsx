"use client";

import { useState } from "react";
import { CONVERSATION_TOPICS, type ConversationTopic } from "@/lib/conversation-topics";
import { ParchmentStains } from "@/components/ParchmentStains";

const STORAGE_KEY = "borderless-shown-topics";

// 한 번 뽑은 주제는 이 기기에서 전부 소진할 때까지 다시 안 나오게 localStorage에
// 뽑은 인덱스를 남긴다 — 다 소진되면 그 기록을 지우고 처음부터 다시 순환.
function pickNextTopic(): ConversationTopic {
  let shown: number[] = [];
  try {
    shown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    shown = [];
  }
  let available = CONVERSATION_TOPICS.map((_, i) => i).filter((i) => !shown.includes(i));
  if (available.length === 0) {
    shown = [];
    available = CONVERSATION_TOPICS.map((_, i) => i);
  }
  const index = available[Math.floor(Math.random() * available.length)];
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...shown, index]));
  return CONVERSATION_TOPICS[index];
}

export function ConversationTopicPanel({ onClose }: { onClose: () => void }) {
  // 이 패널은 버튼 클릭으로만 마운트되어(서버 렌더에는 절대 포함 안 됨) 마운트
  // 시점엔 항상 브라우저이므로, 지연 초기값으로 바로 localStorage에서 뽑는다.
  const [topic, setTopic] = useState<ConversationTopic>(() => pickNextTopic());

  return (
    <div className="parchment-panel relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-line px-4 pt-4 pb-4 text-ink lg:h-full lg:max-h-none lg:w-[40%] lg:flex-none lg:border-t-0 lg:border-l">
      <ParchmentStains idPrefix="topic-panel-stain" intensity={0.4} />
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="label-tech text-[10px] text-muted">이동 중 대화</p>
          <h2 className="text-base font-bold">질문 카드</h2>
        </div>
        <button
          onClick={onClose}
          className="panel-link label-tech text-[10px] text-muted"
        >
          닫기
        </button>
      </div>

      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-line bg-paper px-5 py-5 text-center shadow-[0_2px_6px_rgba(20,18,12,0.05)] lg:flex-1 lg:gap-4 lg:py-10">
        <p className="label-tech text-[10px] text-accent">주제</p>
        <p className="text-lg leading-snug font-semibold break-keep">{topic.q}</p>
        {topic.sub && (
          <p className="text-sm leading-snug break-keep text-muted italic">{topic.sub}</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setTopic(pickNextTopic())}
        className="mt-4 rounded-md bg-accent px-4 py-2.5 text-sm font-bold text-white"
      >
        다음 주제
      </button>
    </div>
  );
}
