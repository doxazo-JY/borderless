"use client";

import { useState } from "react";
import { updateIngredient } from "@/app/admin/[secret]/setup/actions";

export function IngredientEditor({
  ingredientId,
  currentName,
}: {
  ingredientId: string;
  currentName: string;
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
        await updateIngredient(formData);
        setOpen(false);
      }}
      className="flex items-center gap-1"
    >
      <input type="hidden" name="id" value={ingredientId} />
      <input
        name="name"
        defaultValue={currentName}
        className="w-24 rounded border border-zinc-300 p-1 text-[10px]"
      />
      <button
        type="submit"
        className="rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] text-white"
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
