/** 양피지 얼룩 — CSS radial-gradient 타원으로는 "도형을 찍어놓은" 것처럼 보여서
 * (사용자 피드백), feTurbulence 노이즈 자체를 얼룩 모양으로 쓴다. 노이즈는 원래
 * 완전히 불규칙한 무늬라 매끈한 타원이 아니고, 같은 얼룩 안에서도 진한 곳/옅은 곳이
 * 계속 바뀐다 — "모양도 색도 규칙적이면 안 된다"는 요청에 맞는 방식.
 *
 * 만드는 순서(레이어 1개 기준):
 *  1) feTurbulence로 구름 같은 노이즈를 만든다.
 *  2) feColorMatrix로 그 노이즈를 "투명도" 하나로 뭉갠다(색은 나중에 따로 입힌다).
 *  3) feComponentTransfer(gamma)로 중간값을 확 깎아서 – 노이즈 전체가 다 보이는 게
 *     아니라 유난히 두드러진 부분만 섬처럼 남게 만든다. 이게 "얼룩 모양"이 된다.
 *  4) feFlood + feComposite로 그 모양에 갈색을 입힌다.
 * 레이어마다 seed/주파수/색을 다르게 줘서 3장을 겹치면 크기도 색도 뒤섞인다. */
function StainLayer({
  id,
  seed,
  baseFrequency,
  exponent,
  color,
  opacity,
}: {
  id: string;
  seed: number;
  baseFrequency: string;
  exponent: number;
  color: string;
  opacity: number;
}) {
  return (
    <>
      <filter id={id} x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency={baseFrequency} numOctaves="4" seed={seed} result="noise" />
        {/* RGB를 평균 내 알파로 쓰고, 기준선을 낮춰서(-0.2) 노이즈의 절반 가까이를
            아예 안 보이게 깎는다 — 화면 전체가 아니라 일부만 얼룩으로 남긴다. */}
        <feColorMatrix
          in="noise"
          type="matrix"
          values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.4 0.4 0.4 0 -0.17"
          result="shapeAlpha"
        />
        <feComponentTransfer in="shapeAlpha" result="shapeAlphaSharp">
          <feFuncA type="gamma" amplitude="1" exponent={exponent} offset="0" />
        </feComponentTransfer>
        <feFlood floodColor={color} result="tint" />
        <feComposite in="tint" in2="shapeAlphaSharp" operator="in" />
      </filter>
      <rect
        width="100%"
        height="100%"
        filter={`url(#${id})`}
        opacity={opacity}
        style={{ mixBlendMode: "multiply" }}
      />
    </>
  );
}

/** idPrefix: 같은 페이지에 이 컴포넌트를 여러 번 쓸 때(배경 1번 + 패널마다 1번씩)
 * SVG filter id가 겹치면 안 되니까 인스턴스마다 다른 접두어를 준다.
 * intensity: 0~1 — 패널처럼 더 옅게 써야 하는 곳에서 전체 진하기를 한 번에 낮춘다. */
export function ParchmentStains({
  idPrefix = "stain",
  intensity = 1,
}: {
  idPrefix?: string;
  intensity?: number;
}) {
  return (
    <svg className="parchment-stains" width="100%" height="100%" aria-hidden="true">
      <defs />
      {/* 크고 옅게 퍼진 겹 → 작고 진한 반점 겹, 순서대로 쌓아서 깊이감을 준다 */}
      <StainLayer id={`${idPrefix}-1`} seed={4} baseFrequency="0.006 0.009" exponent={4} color="#6b431f" opacity={0.7 * intensity} />
      <StainLayer id={`${idPrefix}-2`} seed={19} baseFrequency="0.01 0.015" exponent={4.8} color="#3a2410" opacity={0.72 * intensity} />
      <StainLayer id={`${idPrefix}-3`} seed={37} baseFrequency="0.02 0.028" exponent={6} color="#1a0d04" opacity={0.6 * intensity} />
    </svg>
  );
}
