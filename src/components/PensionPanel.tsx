"use client";

import Link from "next/link";
import type { RegionProgressItem } from "@/lib/region-progress";

const STATUS_LABEL: Record<RegionProgressItem["status"], string> = {
  done: "완료",
  current: "진행중",
  upcoming: "예정",
};

export function PensionPanel({
  onClose,
  regionProgress,
  earnedIngredients,
  teammatesRegionProgress,
}: {
  onClose: () => void;
  regionProgress: RegionProgressItem[];
  earnedIngredients: { id: string; name: string }[];
  teammatesRegionProgress: {
    groupId: string;
    displayName: string;
    progress: RegionProgressItem[];
  }[];
}) {
  return (
    <div className="relative z-10 flex max-h-[60dvh] flex-col overflow-y-auto border-t border-line bg-paper-panel px-4 pt-4 pb-4 text-ink lg:h-full lg:max-h-none lg:w-[40%] lg:shrink-0 lg:border-t-0 lg:border-l">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="label-tech text-[10px] text-muted">참고 지점</p>
          <h2 className="text-base font-bold">숙소</h2>
        </div>
        <button
          onClick={onClose}
          className="label-tech text-[10px] text-muted underline underline-offset-2"
        >
          닫기
        </button>
      </div>

      <div className="space-y-4">
        <section>
          <p className="label-tech mb-2 text-[10px] text-accent">우리 조 현황</p>
          <ul className="space-y-1">
            {regionProgress.map((p) => (
              <li
                key={p.regionId}
                className="flex items-center justify-between rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm"
              >
                <span className="font-medium">{p.regionName}지역</span>
                <span
                  className={`label-tech text-[10px] ${
                    p.status === "current" ? "font-bold text-accent" : "text-muted"
                  }`}
                >
                  {STATUS_LABEL[p.status]}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="label-tech text-[10px] text-accent">모은 재료</p>
            <Link
              href="/inventory"
              className="label-tech text-[10px] text-muted underline underline-offset-2"
            >
              인벤토리 전체보기
            </Link>
          </div>
          {earnedIngredients.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {earnedIngredients.map((ing) => (
                <li
                  key={ing.id}
                  className="rounded-full border border-line bg-paper px-2 py-1 text-xs"
                >
                  {ing.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">아직 모은 재료가 없어요.</p>
          )}
        </section>

        {teammatesRegionProgress.length > 0 && (
          <section>
            <p className="label-tech mb-2 text-[10px] text-accent">
              같은 팀 다른 조 현황
            </p>
            <div className="space-y-2">
              {teammatesRegionProgress.map((tg) => (
                <div
                  key={tg.groupId}
                  className="rounded-md border border-line bg-paper p-2"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-semibold">{tg.displayName}</span>
                    <span className="label-tech text-[10px] text-muted">
                      {tg.progress.filter((p) => p.status === "done").length} /{" "}
                      {tg.progress.length} 지역 완료
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {tg.progress.map((p) => (
                      <span
                        key={p.regionId}
                        className={`label-tech rounded px-1.5 py-0.5 text-[10px] ${
                          p.status === "done"
                            ? "bg-ink text-paper"
                            : p.status === "current"
                              ? "border border-accent text-accent"
                              : "border border-line text-muted"
                        }`}
                      >
                        {p.regionName}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
