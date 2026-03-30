"use client";

import FactionTable from "@/components/leaderboard/FactionTable";
import { useLiveData } from "@/hooks/useLiveData";
import type { RedMiner, BlueMiner } from "@/data/mock";

interface RankingsResponse {
  red: RedMiner[];
  blue: BlueMiner[];
  lastUpdated: string | null;
}

const EMPTY: RankingsResponse = { red: [], blue: [], lastUpdated: null };

export default function LeaderboardPage() {
  const { data } = useLiveData<RankingsResponse>("/api/rankings", EMPTY, 10000);

  return (
    <div className="flex gap-6">
      <div className="flex-1">
        <FactionTable
          title="Red Faction"
          accentColor="#c45a5a"
          columns={[
            { key: "rank", label: "#" },
            { key: "uid", label: "UID" },
            { key: "breachRate", label: "Breach Rate" },
            { key: "weight", label: "Weight" },
          ]}
          data={data.red}
        />
      </div>
      <div className="flex-1">
        <FactionTable
          title="Blue Faction"
          accentColor="#5a7ac4"
          columns={[
            { key: "rank", label: "#" },
            { key: "uid", label: "UID" },
            { key: "f1Score", label: "F1 Score" },
            { key: "weight", label: "Weight" },
          ]}
          data={data.blue}
        />
      </div>
    </div>
  );
}
