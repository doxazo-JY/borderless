"use client";

import { useState } from "react";
import { updateLocationDetails } from "@/app/admin/[secret]/setup/actions";

type Option = { id: string; label: string };

export function LocationDetailsEditor({
  locationId,
  currentMissionId,
  currentIngredientIds,
  currentJudgePrompt,
  missions,
  ingredients,
}: {
  locationId: string;
  currentMissionId: string | null;
  currentIngredientIds: string[];
  currentJudgePrompt: string;
  missions: Option[];
  ingredients: Option[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[10px] text-blue-600 underline"
      >
        미션/재료/판정질문 수정
      </button>
    );
  }

  return (
    <form
      action={async (formData) => {
        await updateLocationDetails(formData);
        setOpen(false);
      }}
      className="mt-1 space-y-1.5 rounded border border-zinc-200 bg-zinc-50 p-2"
    >
      <input type="hidden" name="id" value={locationId} />
      <textarea
        name="judgePrompt"
        defaultValue={currentJudgePrompt}
        rows={2}
        placeholder="판정 질문"
        className="w-full rounded border border-zinc-300 p-1 text-[10px]"
      />
      <select
        name="missionId"
        defaultValue={currentMissionId ?? ""}
        className="w-full rounded border border-zinc-300 p-1 text-[10px]"
      >
        <option value="">(없음)</option>
        {missions.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-1">
        {ingredients.map((ing) => (
          <label
            key={ing.id}
            className="flex items-center gap-1 rounded border border-zinc-300 px-1.5 py-0.5 text-[10px]"
          >
            <input
              type="checkbox"
              name="ingredientIds"
              value={ing.id}
              defaultChecked={currentIngredientIds.includes(ing.id)}
            />
            {ing.label}
          </label>
        ))}
      </div>
      <div className="flex gap-2">
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
      </div>
    </form>
  );
}
