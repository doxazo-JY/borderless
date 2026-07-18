"use client";

import { toggleGroupSelectionLock } from "@/app/admin/[secret]/setup/actions";

export function GroupLockToggle({ locked }: { locked: boolean }) {
  return (
    <form
      action={toggleGroupSelectionLock}
      className="flex items-center gap-3 rounded border border-zinc-200 p-3"
    >
      <span className="text-sm">
        팀 선택:{" "}
        <span className={locked ? "font-bold text-red-600" : "font-bold text-emerald-600"}>
          {locked ? "잠김" : "해제됨"}
        </span>
      </span>
      <button
        type="submit"
        onClick={(e) => {
          const msg = locked
            ? "팀 선택 잠금을 해제할까요? 다시 참가자들이 팀을 바꿀 수 있게 됩니다."
            : "팀 선택을 잠글까요? 이후 참가자는 '다시 선택'으로 다른 팀/조로 바꿀 수 없습니다 (아직 팀을 안 고른 기기는 계속 선택 가능).";
          if (!confirm(msg)) e.preventDefault();
        }}
        className="ml-auto rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white"
      >
        {locked ? "잠금 해제" : "팀 선택 잠그기"}
      </button>
    </form>
  );
}
