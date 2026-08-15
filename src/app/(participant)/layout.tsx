// SOS 도움 요청 버튼은 지도 화면(MapScreen)에서만 직접 렌더링한다. 예전엔 이
// 레이아웃에서 group 쿠키 유무로 띄웠는데, 팀 선택 화면("/")도 이 레이아웃을
// 같이 쓰다 보니 그룹 선택 잠금 해제 상태에서 "다시 선택" 화면으로 돌아왔을 때도
// (group 쿠키가 남아있어서) 버튼이 떴다 — 아직 장소/미션 맥락이 없는 화면인데 SOS가
// 뜨는 게 어색해서, 실제로 도움이 필요할 수 있는 지도 화면에만 두기로 했다.
export default function ParticipantLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
