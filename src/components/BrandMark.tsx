/** 경계선을 넘는 경로 모티프 — 점선 루트가 지점(핀)에 닿는 형태의 작은 브랜드 심볼 */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M3 21C9 21 8 12 14 12C19 12 18 6 24 6"
        stroke="var(--color-ink)"
        strokeOpacity="0.35"
        strokeWidth="1.6"
        strokeDasharray="1 4.5"
        strokeLinecap="round"
      />
      <circle cx="24" cy="6" r="2.4" fill="var(--color-accent)" />
      <circle
        cx="3"
        cy="21"
        r="2.4"
        fill="var(--color-paper-panel)"
        stroke="var(--color-ink)"
        strokeOpacity="0.35"
        strokeWidth="1.6"
      />
    </svg>
  );
}
