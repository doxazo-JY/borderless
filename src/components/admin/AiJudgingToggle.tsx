"use client";

import { toggleAiJudgingDisabled } from "@/app/admin/[secret]/team/actions";

export function AiJudgingToggle({ disabled }: { disabled: boolean }) {
  return (
    <form
      action={toggleAiJudgingDisabled}
      className="flex items-center gap-3 rounded border border-zinc-200 p-3"
    >
      <span className="text-sm">
        AI 판정:{" "}
        <span className={disabled ? "font-bold text-red-600" : "font-bold text-emerald-600"}>
          {disabled ? "중단 (임원 수동 평가 중)" : "정상 작동"}
        </span>
      </span>
      <button
        type="submit"
        onClick={(e) => {
          const msg = disabled
            ? "AI 판정이 다시 정상 작동한다고 표시할까요? 참가자 화면의 안내 배너가 사라집니다."
            : "AI 판정 API가 막혀서 임원이 수동으로 평가하고 있다고 표시할까요? 참가자 전체 화면 상단에 안내 배너가 뜹니다.";
          if (!confirm(msg)) e.preventDefault();
        }}
        className="ml-auto rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white"
      >
        {disabled ? "정상으로 표시" : "중단으로 표시"}
      </button>
    </form>
  );
}
