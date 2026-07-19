"use client";

export function ConfirmDeleteButton({
  confirmText,
  label = "삭제",
  className = "text-xs text-red-500 underline",
}: {
  confirmText: string;
  label?: string;
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
      {label}
    </button>
  );
}
