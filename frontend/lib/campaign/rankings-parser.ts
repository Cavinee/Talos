import fs from "node:fs/promises";
import path from "node:path";

import { CAMPAIGN_RUNTIME_LOG_DIRECTORY } from "./process-manager.ts";

export interface MinerRanking {
  uid: number;
  role: "red" | "blue";
  avgScore: number;
  normalizedWeight: number;
  rank: number;
  validatorKey: string;
}

export interface CampaignRankings {
  red: MinerRanking[];
  blue: MinerRanking[];
  lastUpdatedAt: string | null;
  validatorsCompleted: number;
}

const EMPTY_RANKINGS: CampaignRankings = {
  red: [],
  blue: [],
  lastUpdatedAt: null,
  validatorsCompleted: 0,
};

// Strip ANSI escape sequences from a line so regexes work cleanly.
function stripAnsi(line: string): string {
  // eslint-disable-next-line no-control-regex
  return line.replace(/\x1b\[[0-9;]*m/g, "");
}

interface ValidatorData {
  roleMap: Map<number, "red" | "blue">;
  avgScores: Map<number, number>;
  weights: Map<number, number>;
  completed: boolean;
  mtimeMs: number;
  validatorKey: string;
}

function parseLogContent(content: string, validatorKey: string, mtimeMs: number): ValidatorData {
  const roleMap = new Map<number, "red" | "blue">();
  const avgScores = new Map<number, number>();
  const weights = new Map<number, number>();
  let completed = false;

  // Regex to detect epoch scores lines, then extract all role/uid pairs from them
  const epochHeaderPattern = /Epoch \d+ scores/;
  const rolePairPattern = /(Red|Blue) (\d+):/gi;
  // Regex for avg_score lines
  const avgScorePattern = /UID (\d+): avg_score=([\d.]+)/;
  // Regex for the weights line
  const weightsPattern = /Setting weights: UIDs=\[(.+?)\], Weights=\[(.+?)\]/;
  // Completion sentinel
  const completionSentinel = "All epochs complete. Validator exiting.";

  for (const rawLine of content.split("\n")) {
    const line = stripAnsi(rawLine);

    if (line.includes(completionSentinel)) {
      completed = true;
    }

    // Extract role/uid pairs from epoch scores lines (one line may have multiple pairs)
    if (epochHeaderPattern.test(line)) {
      let roleMatch: RegExpExecArray | null;
      const pairScanner = new RegExp(rolePairPattern.source, "gi");
      while ((roleMatch = pairScanner.exec(line)) !== null) {
        const role = roleMatch[1].toLowerCase() as "red" | "blue";
        const uid = parseInt(roleMatch[2], 10);
        roleMap.set(uid, role);
      }
    }

    // Extract avg_score
    const avgMatch = avgScorePattern.exec(line);
    if (avgMatch) {
      const uid = parseInt(avgMatch[1], 10);
      const score = parseFloat(avgMatch[2]);
      avgScores.set(uid, score);
    }

    // Extract weights vector
    const weightsMatch = weightsPattern.exec(line);
    if (weightsMatch) {
      const uidStrings = weightsMatch[1].split(",").map((s) => s.trim());
      const weightStrings = weightsMatch[2].split(",").map((s) => s.trim());

      for (let i = 0; i < uidStrings.length; i++) {
        const uid = parseInt(uidStrings[i], 10);
        const weight = parseFloat(weightStrings[i]);
        if (!Number.isNaN(uid) && !Number.isNaN(weight)) {
          weights.set(uid, weight);
        }
      }
    }
  }

  return { roleMap, avgScores, weights, completed, mtimeMs, validatorKey };
}

export async function parseCampaignRankings(
  logDirectory: string,
): Promise<CampaignRankings> {
  let entries: fs.Dirent[];

  try {
    entries = await fs.readdir(logDirectory, { withFileTypes: true });
  } catch {
    return { ...EMPTY_RANKINGS };
  }

  const logFiles = entries.filter(
    (e) => e.isFile() && /^validator_.*\.log$/.test(e.name),
  );

  if (logFiles.length === 0) {
    return { ...EMPTY_RANKINGS };
  }

  const validatorDataList: ValidatorData[] = [];

  for (const entry of logFiles) {
    const filePath = path.join(logDirectory, entry.name);
    const validatorKey = entry.name.replace(/\.log$/, "");

    try {
      const [content, stat] = await Promise.all([
        fs.readFile(filePath, "utf8"),
        fs.stat(filePath),
      ]);
      validatorDataList.push(
        parseLogContent(content, validatorKey, stat.mtimeMs),
      );
    } catch {
      // Skip unreadable files
    }
  }

  if (validatorDataList.length === 0) {
    return { ...EMPTY_RANKINGS };
  }

  // Sort by mtime ascending so later files overwrite earlier ones
  validatorDataList.sort((a, b) => a.mtimeMs - b.mtimeMs);

  // Merge: later file wins for same UID
  const mergedEntries = new Map<
    number,
    { role: "red" | "blue"; avgScore: number; normalizedWeight: number; validatorKey: string }
  >();

  for (const data of validatorDataList) {
    // Only include UIDs that have both a role mapping AND an avg_score
    for (const [uid, role] of data.roleMap) {
      const avgScore = data.avgScores.get(uid);
      if (avgScore === undefined) {
        continue;
      }
      const normalizedWeight = data.weights.get(uid) ?? 0;
      mergedEntries.set(uid, { role, avgScore, normalizedWeight, validatorKey: data.validatorKey });
    }
  }

  if (mergedEntries.size === 0) {
    return { ...EMPTY_RANKINGS };
  }

  // Split into red and blue, sort by avgScore descending, assign rank
  const redMiners: MinerRanking[] = [];
  const blueMiners: MinerRanking[] = [];

  for (const [uid, entry] of mergedEntries) {
    const miner: Omit<MinerRanking, "rank"> = {
      uid,
      role: entry.role,
      avgScore: entry.avgScore,
      normalizedWeight: entry.normalizedWeight,
      validatorKey: entry.validatorKey,
    };

    if (entry.role === "red") {
      redMiners.push({ ...miner, rank: 0 });
    } else {
      blueMiners.push({ ...miner, rank: 0 });
    }
  }

  redMiners.sort((a, b) => b.avgScore - a.avgScore);
  blueMiners.sort((a, b) => b.avgScore - a.avgScore);

  for (let i = 0; i < redMiners.length; i++) {
    redMiners[i].rank = i + 1;
  }
  for (let i = 0; i < blueMiners.length; i++) {
    blueMiners[i].rank = i + 1;
  }

  // Determine lastUpdatedAt from the latest mtime across all files
  const latestMtime = Math.max(...validatorDataList.map((d) => d.mtimeMs));
  const lastUpdatedAt = new Date(latestMtime).toISOString();

  const validatorsCompleted = validatorDataList.filter((d) => d.completed).length;

  return {
    red: redMiners,
    blue: blueMiners,
    lastUpdatedAt,
    validatorsCompleted,
  };
}

export async function getCampaignRankings(): Promise<CampaignRankings> {
  return parseCampaignRankings(CAMPAIGN_RUNTIME_LOG_DIRECTORY);
}
