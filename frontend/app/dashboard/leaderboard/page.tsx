import FactionTable from "@/components/leaderboard/FactionTable";
import { redFaction, blueFaction } from "@/data/mock";

export default function LeaderboardPage() {
  return (
    <div className="flex gap-6">
      <div className="flex-1">
        <FactionTable
          title="Red Faction"
          accentColor="#c45a5a"
          columns={[
            { key: "rank", label: "#" },
            { key: "uid", label: "Miner UID" },
            { key: "severity", label: "Severity" },
            { key: "novelty", label: "Novelty" },
            { key: "combinedScore", label: "Combined" },
          ]}
          data={redFaction}
        />
      </div>
      <div className="flex-1">
        <FactionTable
          title="Blue Faction"
          accentColor="#5a7ac4"
          columns={[
            { key: "rank", label: "#" },
            { key: "uid", label: "Validator UID" },
            { key: "recall", label: "Recall %" },
            { key: "precision", label: "Precision %" },
            { key: "latency", label: "Latency (ms)" },
          ]}
          data={blueFaction}
        />
      </div>
    </div>
  );
}
