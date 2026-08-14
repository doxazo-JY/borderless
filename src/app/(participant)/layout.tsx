import { getCurrentGroup } from "@/lib/group";
import { HelpButton } from "@/components/HelpButton";

// 참가자 화면(팀 선택 "/", 지도 "/map")에서만 SOS 도움 요청 버튼을 띄운다.
// 예전엔 루트 레이아웃에 있어서, 임원이 같은 브라우저로 참가자 플로우를
// 테스트해본 뒤 group 쿠키가 남아있으면 /admin 화면에도 버튼이 떴다.
export default async function ParticipantLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const group = await getCurrentGroup();

  return (
    <>
      {children}
      {group && <HelpButton />}
    </>
  );
}
