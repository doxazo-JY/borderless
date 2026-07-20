"use client";

import { useState } from "react";
import { updateMission } from "@/app/admin/[secret]/setup/actions";

const MISSION_LABEL: Record<string, string> = {
  WORD: "말씀",
  PRAISE: "찬양",
  PRAYER: "기도",
};

export function MissionEditor({
  missionId,
  currentType,
  currentContent,
}: {
  missionId: string;
  currentType: string;
  currentContent: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[10px] text-blue-600 underline"
      >
        수정
      </button>
    );
  }

  return (
    <form
      action={async (formData) => {
        await updateMission(formData);
        setOpen(false);
      }}
      className="mt-1 flex flex-wrap items-center gap-1.5 rounded border border-zinc-200 bg-zinc-50 p-1.5"
    >
      <input type="hidden" name="id" value={missionId} />
      <select
        name="type"
        defaultValue={currentType}
        className="rounded border border-zinc-300 p-1 text-[10px]"
      >
        {Object.entries(MISSION_LABEL).map(([type, label]) => (
          <option key={type} value={type}>
            {label}
          </option>
        ))}
      </select>
      <input
        name="content"
        defaultValue={currentContent}
        placeholder="본문/기도 주제 (찬양은 비워둬도 됨)"
        className="min-w-0 flex-1 rounded border border-zinc-300 p-1 text-[10px]"
      />
      <button
        type="submit"
        className="rounded bg-zinc-900 px-2 py-1 text-[10px] text-white"
      >
        저장
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-[10px] text-zinc-500 underline"
      >
        취소
      </button>
    </form>
  );
}
