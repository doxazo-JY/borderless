import { notFound } from "next/navigation";
import { GalleryContent } from "@/components/admin/GalleryContent";

// 어드민 전체 화면(설정/팀)과 분리해서 갤러리만 공유하고 싶을 때 쓰는 전용 링크.
// ADMIN_SECRET_PATH와 완전히 다른 비밀값(GALLERY_SECRET_PATH)으로만 보호돼서,
// 이 링크를 받은 사람은 설정/팀 쪽에는 (경로를 알아내도) 들어갈 수 없다.
export default async function PublicGalleryPage({
  params,
}: {
  params: Promise<{ secret: string }>;
}) {
  const { secret } = await params;
  if (!process.env.GALLERY_SECRET_PATH || secret !== process.env.GALLERY_SECRET_PATH) {
    notFound();
  }

  return <GalleryContent />;
}
