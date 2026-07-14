import { redirect } from "next/navigation";
import { getCurrentGroup } from "@/lib/group";
import { clearGroup } from "@/app/actions";

export default async function MapPage() {
  const group = await getCurrentGroup();
  if (!group) {
    redirect("/");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="text-sm text-zinc-500">선택된 그룹</p>
      <h1 className="text-3xl font-bold">{group.displayName}</h1>
      <p className="text-sm text-zinc-400">
        지도 화면은 다음 단계(Kakao 지도 연동)에서 만들 예정입니다.
      </p>
      <form action={clearGroup}>
        <button
          type="submit"
          className="mt-6 text-sm text-zinc-500 underline underline-offset-2"
        >
          다른 그룹으로 다시 선택
        </button>
      </form>
    </main>
  );
}
