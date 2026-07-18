"use client";

export function ConfirmDeleteButton({
  confirmText,
  className = "text-xs text-red-500 underline",
}: {
  confirmText: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
      className={className}
    >
      삭제
    </button>
  );
}
