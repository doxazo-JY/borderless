import { notFound } from "next/navigation";
import { GalleryContent } from "@/components/admin/GalleryContent";

// 어드민 전체 화면(설정/팀)과 분리해서 갤러리만 공유하고 싶을 때 쓰는 전용 링크.
// 환경변수 추가 없이 바로 쓸 수 있게 비밀값을 코드에 직접 박아뒀다 — 이미
// ADMIN_SECRET_PATH도 같은 방식(추측 어려운 URL만으로 보호)이라 일관된
// 선택이고, 이 값만 알아서는 ADMIN_SECRET_PATH를 유추할 수 없다.
const GALLERY_SECRET = "hJEDG7jt";

export default async function PublicGalleryPage({
  params,
}: {
  params: Promise<{ secret: string }>;
}) {
  const { secret } = await params;
  if (secret !== GALLERY_SECRET) {
    notFound();
  }

  return <GalleryContent />;
}
