/** 양피지 실험용 그을린 가장자리 — feTurbulence로 두꺼운 테두리 선을 울퉁불퉁하게
 * 흩뜨려서 불에 그슬린 종이 가장자리처럼 보이게 한다. 두 겹을 서로 다른 노이즈 시드로
 * 흔들어서 같은 자리에서 겹치지 않게 한다(그래야 각지게 안 보인다).
 * .route-map 실험이 폐기되면 이 컴포넌트도 같이 지운다. */
export function ParchmentBurn() {
  return (
    // 화면 전체를 덮는 투명 캔버스. 실제 위치·크기(inset:0)는
    // globals.css의 .parchment-burn 클래스가 정한다.
    <svg
      className="parchment-burn"
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {/* ── 필터 정의부: 화면에 직접 안 그려지고, 아래 <rect>들이 "url(#id)"로
          가져다 쓰는 도구 상자다. feTurbulence가 노이즈(불규칙한 무늬)를 만들고,
          feDisplacementMap이 그 노이즈만큼 도형의 윤곽선을 실제로 흔들어 놓는다. */}
      <filter id="burn-jitter-1" x="-30%" y="-30%" width="160%" height="160%">
        {/*
          baseFrequency: 무늬가 얼마나 촘촘한지(숫자가 클수록 잘게 꼬물거림, 작을수록
            크고 완만한 굽이). 앞이 가로 방향, 뒤가 세로 방향 흔들림 빈도.
          seed: 무늬의 "모양 시드값" — 숫자만 다르면 완전히 다른 굽이 패턴이 나온다.
            burn-jitter-1과 -2가 seed를 다르게 쓰는 이유가, 두 겹이 같은 자리에서
            같이 흔들려서 결국 다시 매끈한 직선처럼 보이는 걸 막기 위해서다.
        */}
        <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="3" seed="11" result="noise" />
        {/* scale: 실제로 선을 얼마나 멀리(픽셀 단위) 밀어낼지 — 숫자를 키우면 더 울퉁불퉁해진다. */}
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="34" xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <filter id="burn-jitter-2" x="-30%" y="-30%" width="160%" height="160%">
        <feTurbulence type="fractalNoise" baseFrequency="0.015 0.026" numOctaves="3" seed="41" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="26" xChannelSelector="R" yChannelSelector="G" />
      </filter>

      {/* ── 실제로 그려지는 테두리 두 겹. 둘 다 "네모(rect)"에서 시작하지만
          filter="url(#burn-jitter-…)" 때문에 화면엔 울퉁불퉁하게 보인다.
          아래쪽(먼저 그려지는) 겹 — 더 두껍고(strokeWidth) 더 진한(stroke) 바탕 그을림. */}
      <rect
        x="1%" // 화면 가장자리에서 얼마나 안쪽에서 시작할지 (1% = 거의 끝까지)
        y="1%"
        width="98%" // x/y와 짝을 맞춰 네모가 화면을 거의 꽉 채우게
        height="98%"
        fill="none" // 안쪽은 안 채우고 테두리 선만 그림
        stroke="#241206" // 선 색 — 가장 어두운 그을음
        strokeOpacity="0.4" // 선 투명도(0~1) — 낮을수록 배경이 비쳐 보임
        strokeWidth="54" // 선 두께(px) — 키우면 더 두꺼운 그을린 띠가 됨
        filter="url(#burn-jitter-1)" // 위에서 정의한 흔들림 필터 적용
      />
      {/* 위쪽(나중에 그려져서 겹쳐 보이는) 겹 — 더 얇고 옅은 색, 다른 흔들림
          패턴(burn-jitter-2)이라 아래 겹과 굽이가 어긋나 보이게 한다. */}
      <rect
        x="1.2%"
        y="1.2%"
        width="97.6%"
        height="97.6%"
        fill="none"
        stroke="#3a2410"
        strokeOpacity="0.3"
        strokeWidth="34"
        filter="url(#burn-jitter-2)"
      />
    </svg>
  );
}
