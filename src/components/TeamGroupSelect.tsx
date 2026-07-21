"use client";

import { useState } from "react";
import { selectGroup } from "@/app/actions";
import { teamColor } from "@/lib/team-colors";

export function TeamGroupSelect({
  teams,
}: {
  teams: {
    id: string;
    name: string;
    groups: { id: string; displayName: string }[];
  }[];
}) {
  const [name1, setName1] = useState("");
  const [name2, setName2] = useState("");
  const trimmedName1 = name1.trim();
  const trimmedName2 = name2.trim();
  const bothNamed = !!trimmedName1 && !!trimmedName2;

  return (
    <div className="grid w-full max-w-sm gap-6">
      <div>
        <label className="label-tech mb-1 block text-xs font-bold text-accent">
          조원 이름 (2명)
        </label>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={name1}
            onChange={(e) => setName1(e.target.value)}
            placeholder="이름 1"
            className="w-full rounded-lg border-2 border-line bg-paper-panel px-3 py-2 text-base text-ink"
          />
          <input
            value={name2}
            onChange={(e) => setName2(e.target.value)}
            placeholder="이름 2"
            className="w-full rounded-lg border-2 border-line bg-paper-panel px-3 py-2 text-base text-ink"
          />
        </div>
        <p className="mt-1 text-xs text-muted">
          도움 요청 시 어느 조원인지 확인하는 용도예요.
        </p>
      </div>

      {teams.map((team) => (
        <div key={team.id}>
          <h2
            className="label-tech mb-2 text-xs font-bold"
            style={{ color: teamColor(team.name) }}
          >
            {team.name}팀
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {team.groups.map((group) => (
              <form key={group.id} action={selectGroup}>
                <input type="hidden" name="groupId" value={group.id} />
                <input type="hidden" name="memberName1" value={trimmedName1} />
                <input type="hidden" name="memberName2" value={trimmedName2} />
                <button
                  type="submit"
                  disabled={!bothNamed}
                  className="w-full rounded-lg border-2 py-4 text-lg font-bold transition-colors disabled:opacity-40"
                  style={{
                    borderColor: teamColor(team.name),
                    color: "var(--color-ink)",
                    background: "var(--color-paper-panel)",
                  }}
                >
                  {group.displayName}
                </button>
              </form>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
