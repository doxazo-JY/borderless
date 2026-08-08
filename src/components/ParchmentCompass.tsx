/** 양피지 실험용 장식 나침반 — 클래식 보물지도의 8방위 별 나침반. 화면 모서리에
 * 고정 배치하며(뷰박스 슬라이스 크롭 영향을 안 받도록), 팀 컬러가 아닌 잉크색 하나만
 * 쓴다. .route-map 실험이 폐기되면 이 컴포넌트도 같이 지운다. */
export function ParchmentCompass({ className = "" }: { className?: string }) {
  const ink = "#3a2410";

  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <filter id="compass-jitter" x="-30%" y="-30%" width="160%" height="160%">
        <feTurbulence type="fractalNoise" baseFrequency="0.03 0.05" numOctaves="2" seed="9" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <g transform="translate(50 50)" filter="url(#compass-jitter)" stroke={ink} fill="none" strokeOpacity="0.75">
        <circle r="38" strokeWidth="1" />
        <circle r="30" strokeWidth="0.6" />
        {[0, 90, 180, 270].map((deg) => (
          <path
            key={deg}
            d="M0 -38 L5 -8 L0 0 L-5 -8 Z"
            fill={ink}
            fillOpacity="0.8"
            stroke="none"
            transform={`rotate(${deg})`}
          />
        ))}
        {[45, 135, 225, 315].map((deg) => (
          <path
            key={deg}
            d="M0 -26 L3 -6 L0 0 L-3 -6 Z"
            fill={ink}
            fillOpacity="0.55"
            stroke="none"
            transform={`rotate(${deg})`}
          />
        ))}
      </g>
      <text x="50" y="8" textAnchor="middle" className="label-tech" fontSize="7" fill={ink} fillOpacity="0.75">N</text>
      <text x="50" y="97" textAnchor="middle" className="label-tech" fontSize="7" fill={ink} fillOpacity="0.75">S</text>
      <text x="95" y="53" textAnchor="middle" className="label-tech" fontSize="7" fill={ink} fillOpacity="0.75">E</text>
      <text x="5" y="53" textAnchor="middle" className="label-tech" fontSize="7" fill={ink} fillOpacity="0.75">W</text>
    </svg>
  );
}
