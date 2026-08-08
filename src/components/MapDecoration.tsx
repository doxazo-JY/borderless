/** 팀 선택 화면 배경 장식 — 화면 가장자리에서 버튼 영역으로 모여드는 손맛 있는 루트 +
 * "X" 마크(보물지도의 X marks the spot 모티프, 핀 드롭 대신). 팀 컬러(빨강/초록/파랑/금)를
 * 그대로 쓰면 채도가 너무 높아서 세피아 양피지 위에서 장난감 같은 게임 지도처럼 보였다
 * (사용자 피드백) — 그래서 이 장식만은 예외적으로 색을 낡은 잉크 톤 하나로 통일한다.
 * feTurbulence로 선에 미세한 흔들림을 줘서 완벽한 베지어 곡선이 아니라 손으로 그은
 * 느낌을 낸다. */
const AGED_INK = "#5b3a1e";
const BRUSH_INK_1 = "#7c3c1e";
const BRUSH_INK_2 = "#6e351a";

/** X 마크 한 획(-9~9, x축 방향, 사용자가 준 레퍼런스 CSS의 clip-path 다각형을
 * 그대로 SVG 좌표로 옮긴 것) — 위아래 가장자리를 삐뚤빼뚤한 다각형으로 잘라내서
 * 매끈한 곡선이 아니라 붓이 스친 자국처럼 보이게 한다. 두 획을 45°/-45°로 돌려서
 * X자를 만든다. */
const BRUSH_STROKE_JAGGED =
  "M -9 -0.43 L -8.28 -0.97 L -6.84 -0.76 L -5.4 -1.3 L -3.42 -0.97 " +
  "L -1.26 -1.26 L 0.54 -0.9 L 3.06 -1.37 L 4.86 -0.97 L 6.84 -1.22 " +
  "L 9 -0.32 L 8.1 0.61 L 6.3 0.9 L 4.68 0.58 L 2.34 1.04 L 0 0.68 " +
  "L -2.16 1.19 L -4.14 0.83 L -6.3 1.22 L -8.1 0.65 Z";

/** 붓 몸통 주변에 튄 잉크 자국 — 튀었다는 건 우연히 한두 방울 떨어진 거지 여러 개
 * 흩뿌려질 일이 아니라서, X마크마다 0개 또는 1개만 두고 위치만 다르게 한다. 각 점은
 * [가로 오프셋, 세로 오프셋, 가로반지름, 세로반지름, 회전각, 진하기, 잉크색 인덱스(0|1)]. */
const INK_SPLATTER_SETS: [number, number, number, number, number, number, 0 | 1][][] = [
  [[-4, -6.4, 0.75, 0.55, 20, 0.5, 0]],
  [],
  [[8.6, 3.1, 0.3, 0.45, -25, 0.55, 1]],
  [],
];

export function MapDecoration() {
  return (
    <svg
      className="route-map-decoration"
      viewBox="0 0 400 600"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <filter id="sketchy-fine" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="sketchy-coarse" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.035" numOctaves="2" seed="3" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* 점선 하나하나 안에서도 잉크 농도가 들쭉날쭉하게 — 노이즈를 만들어서 그
            노이즈의 밝기를 그대로 투명도로 쓰고(feColorMatrix), 원래 점선과
            겹치는 부분만 남긴다(feComposite in). 점이 통째로 옅어지지 않도록
            feComponentTransfer로 투명도 범위를 0.35~0.95 사이로 눌러둔다. */}
        <filter id="ink-mottle" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.35 0.55" numOctaves="2" seed="5" result="mottleNoise" />
          <feColorMatrix
            in="mottleNoise"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.33 0.33 0.33 0 0"
            result="mottleAlpha"
          />
          <feComponentTransfer in="mottleAlpha" result="mottleAlphaEased">
            <feFuncA type="linear" slope="0.6" intercept="0.35" />
          </feComponentTransfer>
          <feComposite in="SourceGraphic" in2="mottleAlphaEased" operator="in" />
        </filter>
        {/* 붓 몸통 양 끝이 마르듯 옅어지는 그라디언트 — 균일한 색 대신 끝에서 투명해져야
            "붓으로 쓱 그은" 느낌이 난다. 두 획(brush-fade-1/2)에 서로 다른 갈색을 써서
            겹치는 부분에 톤 차이가 생기게 한다. */}
        <linearGradient id="brush-fade-1" x1="0%" x2="100%" y1="0%" y2="0%">
          <stop offset="0%" stopColor={BRUSH_INK_1} stopOpacity="0" />
          <stop offset="10%" stopColor={BRUSH_INK_1} stopOpacity="0.85" />
          <stop offset="50%" stopColor={BRUSH_INK_1} stopOpacity="1" />
          <stop offset="90%" stopColor={BRUSH_INK_1} stopOpacity="0.8" />
          <stop offset="100%" stopColor={BRUSH_INK_1} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="brush-fade-2" x1="0%" x2="100%" y1="0%" y2="0%">
          <stop offset="0%" stopColor={BRUSH_INK_2} stopOpacity="0" />
          <stop offset="13%" stopColor={BRUSH_INK_2} stopOpacity="0.8" />
          <stop offset="50%" stopColor={BRUSH_INK_2} stopOpacity="0.95" />
          <stop offset="87%" stopColor={BRUSH_INK_2} stopOpacity="0.75" />
          <stop offset="100%" stopColor={BRUSH_INK_2} stopOpacity="0" />
        </linearGradient>
      </defs>

      <g filter="url(#sketchy-fine)">
        <path
          className="route-map-decoration__trail"
          d="M -20 80 C 60 60, 90 160, 170 190 S 260 300, 340 300"
          stroke={AGED_INK}
          filter="url(#ink-mottle)"
        />
        <path
          className="route-map-decoration__trail"
          d="M 420 40 C 320 70, 300 150, 220 210 S 150 320, 60 360"
          stroke={AGED_INK}
          filter="url(#ink-mottle)"
        />
        <path
          className="route-map-decoration__trail"
          d="M -30 480 C 70 470, 110 400, 190 400 S 300 340, 410 260"
          stroke={AGED_INK}
          filter="url(#ink-mottle)"
        />
        <path
          className="route-map-decoration__trail"
          d="M 200 620 C 210 540, 160 500, 200 440 S 300 400, 300 320"
          stroke={AGED_INK}
          filter="url(#ink-mottle)"
        />
      </g>

      {[
        { x: 340, y: 300, rotate: -6 },
        { x: 60, y: 360, rotate: 8 },
        { x: 410, y: 260, rotate: -4 },
        { x: 300, y: 320, rotate: 5 },
      ].map((mark, i) => (
        <g
          key={i}
          className="route-map-decoration__pin"
          transform={`translate(${mark.x} ${mark.y}) rotate(${mark.rotate})`}
        >
          {/* 두 획(45°/-45°) — 삐뚤빼뚤한 다각형(BRUSH_STROKE_JAGGED) + 양 끝이
              옅어지는 그라디언트 채우기로 "붓으로 스친 자국"을 낸다. */}
          <path d={BRUSH_STROKE_JAGGED} fill="url(#brush-fade-1)" transform="rotate(45)" />
          <path d={BRUSH_STROKE_JAGGED} fill="url(#brush-fade-2)" transform="rotate(-45)" />
          {/* 붓 자국 주변에 흩뿌려진 작은 잉크 튀김 — 완전한 원이 아니라 살짝 찌그러진
              타원(rx≠ry)에 회전을 줘서 튀긴 자국처럼 불규칙하게 보이게 한다. */}
          {INK_SPLATTER_SETS[i % INK_SPLATTER_SETS.length].map(
            ([dx, dy, rx, ry, rot, op, colorIdx], si) => (
              <ellipse
                key={si}
                cx={dx}
                cy={dy}
                rx={rx}
                ry={ry}
                transform={`rotate(${rot} ${dx} ${dy})`}
                fill={colorIdx === 0 ? BRUSH_INK_1 : BRUSH_INK_2}
                fillOpacity={op}
              />
            ),
          )}
        </g>
      ))}
    </svg>
  );
}
