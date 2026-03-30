"use client";

import { useEffect, useRef, useState } from "react";

import FactionTable from "@/components/leaderboard/FactionTable";

interface MinerRanking {
  uid: number;
  role: "red" | "blue";
  avgScore: number;
  normalizedWeight: number;
  rank: number;
  validatorKey: string;
}

interface RankingsResponse {
  rankings: {
    red: MinerRanking[];
    blue: MinerRanking[];
    lastUpdatedAt: string;
    validatorsCompleted: number;
  };
}

const DEFAULT_POLL_INTERVAL_MS = 3000;

interface LeaderboardPageProps {
  pollIntervalMs?: number;
}

export default function LeaderboardPage({
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: LeaderboardPageProps) {
  const [red, setRed] = useState<MinerRanking[]>([]);
  const [blue, setBlue] = useState<MinerRanking[]>([]);
  const mountedRef = useRef(true);
  const timerRef = useRef<number | null>(null);
  const fetchRef = useRef<() => Promise<void>>(async () => {});

  async function fetchRankings() {
    try {
      const response = await fetch("/api/campaign/rankings");
      const payload = (await response.json()) as RankingsResponse;

      if (!mountedRef.current) {
        return;
      }

      setRed(payload.rankings.red ?? []);
      setBlue(payload.rankings.blue ?? []);
    } catch {
      // silently ignore fetch errors — stale data stays displayed
    }
  }

  fetchRef.current = fetchRankings;

  useEffect(() => {
    mountedRef.current = true;
    void fetchRef.current();

    timerRef.current = window.setInterval(() => {
      void fetchRef.current();
    }, pollIntervalMs);

    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [pollIntervalMs]);

  const isEmpty = red.length === 0 && blue.length === 0;

  if (isEmpty) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-text-secondary text-sm">
          No rankings yet — waiting for validators to complete an epoch.
        </p>
      </div>
    );
  }

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
          data={red.map((r) => ({
            rank: r.rank,
            uid: r.uid,
            breachRate: (r.avgScore * 100).toFixed(1) + "%",
            weight: (r.normalizedWeight * 100).toFixed(1) + "%",
          }))}
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
          data={blue.map((r) => ({
            rank: r.rank,
            uid: r.uid,
            f1Score: (r.avgScore * 100).toFixed(1) + "%",
            weight: (r.normalizedWeight * 100).toFixed(1) + "%",
          }))}
        />
      </div>
    </div>
  );
}
