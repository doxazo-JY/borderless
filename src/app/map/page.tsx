import { redirect } from "next/navigation";
import { getCurrentGroup } from "@/lib/group";
import { clearGroup } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { KakaoMap } from "@/components/KakaoMap";

export default async function MapPage() {
  const group = await getCurrentGroup();
  if (!group) {
    redirect("/");
  }

  const locations = await prisma.location.findMany({
    include: { region: true },
    orderBy: [{ region: { name: "asc" } }, { name: "asc" }],
  });

  const mapLocations = locations.map((loc) => ({
    id: loc.id,
    name: loc.name,
    regionName: loc.region.name,
    lat: loc.lat,
    lng: loc.lng,
  }));

  return (
    <main className="flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <div>
          <p className="text-xs text-zinc-500">선택된 그룹</p>
          <h1 className="text-lg font-bold">{group.displayName}</h1>
        </div>
        <form action={clearGroup}>
          <button
            type="submit"
            className="text-xs text-zinc-500 underline underline-offset-2"
          >
            다시 선택
          </button>
        </form>
      </div>

      <div className="min-h-0 flex-1">
        <KakaoMap locations={mapLocations} />
      </div>
    </main>
  );
}
