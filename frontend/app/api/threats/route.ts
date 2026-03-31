import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

interface RankingsEntry {
  uid: string;
  rank: number;
  severity?: number;
  novelty?: number;
  combinedScore?: number;
  precision?: number;
  recall?: number;
  latency?: number;
}

interface Rankings {
  red: RankingsEntry[];
  blue: RankingsEntry[];
}

function loadRankings(): Rankings | null {
  try {
    const rankingsPath = path.join(process.cwd(), "..", "subnet", "rankings.json");
    const raw = fs.readFileSync(rankingsPath, "utf-8");
    return JSON.parse(raw) as Rankings;
  } catch {
    return null;
  }
}

function enrichThreats(threats: Record<string, unknown>[], rankings: Rankings): Record<string, unknown>[] {
  const redByUid = new Map((rankings.red ?? []).map((r) => [r.uid, r]));
  const blueByUid = new Map((rankings.blue ?? []).map((b) => [b.uid, b]));

  return threats.map((threat) => {
    const red = threat.redMiner as { uid?: string } | undefined;
    const blue = threat.blueMiner as { uid?: string } | undefined;

    const redRanking = red?.uid ? redByUid.get(red.uid) : undefined;
    const blueRanking = blue?.uid ? blueByUid.get(blue.uid) : undefined;

    return {
      ...threat,
      ...(redRanking && {
        redMiner: {
          ...red,
          rank: redRanking.rank,
          severity: redRanking.severity,
          novelty: redRanking.novelty,
          combinedScore: redRanking.combinedScore,
        },
      }),
      ...(blueRanking && {
        blueMiner: {
          ...blue,
          rank: blueRanking.rank,
          precision: blueRanking.precision,
          recall: blueRanking.recall,
          latency: blueRanking.latency,
        },
      }),
    };
  });
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10));

  const filePath = path.join(process.cwd(), "..", "subnet", "threat_stream.json");

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const all: Record<string, unknown>[] = JSON.parse(raw);
    const threats = all.slice(-limit).reverse();
    const rankings = loadRankings();
    const enriched = rankings ? enrichThreats(threats, rankings) : threats;
    return NextResponse.json({ threats: enriched });
  } catch {
    return NextResponse.json({ threats: [] });
  }
}
