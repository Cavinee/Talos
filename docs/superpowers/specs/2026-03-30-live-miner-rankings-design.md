# Live Miner Rankings on the Campaign Leaderboard

**Date:** 2026-03-30
**Branch:** `codex-campaign-localnet-control-panel`
**Status:** Approved — ready for implementation planning

## Problem

The leaderboard tab (`/dashboard/leaderboard`) displays hardcoded mock data.
After a validator completes its epoch run it sets on-chain weights and logs
per-UID scores, but this data never reaches the UI. Additionally, validators
that finish cleanly show as "Failed" because the process manager treats any
dead PID as a crash.

## Approach

Parse validator log files on the server side. No changes to the subnet Python
code. The frontend polls the new endpoint on the same 3-second cycle used by
the service status poller.

## Backend: Log Parser

New module: `frontend/lib/campaign/rankings-parser.ts`

Reads all validator log files matching `.runtime/logs/validator_*.log` and
extracts four data points per file using regex:

1. **Role mapping** — `Epoch \d+ scores - (Red|Blue) (\d+):` lines produce
   `{ uid -> "red" | "blue" }`.
2. **Per-UID average scores** — `UID (\d+): avg_score=([\d.]+)` lines.
3. **Final weights vector** — `Setting weights: UIDs=\[(.+?)\], Weights=\[(.+?)\]`.
4. **Completion sentinel** — presence of `All epochs complete. Validator exiting.`
   at the end of the file indicates a clean exit.

When multiple validators produce scores for the same UID, the entry from the
later log file wins (compared by file modification time).

### Types

```ts
interface MinerRanking {
  uid: number;
  role: "red" | "blue";
  avgScore: number;          // raw 0-1
  normalizedWeight: number;  // from the Setting weights line
  rank: number;              // sorted by avgScore descending within role
  validatorKey: string;      // e.g. "validator_1"
}

interface CampaignRankings {
  red: MinerRanking[];
  blue: MinerRanking[];
  lastUpdatedAt: string | null; // ISO timestamp parsed from the last log line
  validatorsCompleted: number;  // count of validators whose logs have the sentinel
}
```

## Backend: API Route

`GET /api/campaign/rankings` returns `{ rankings: CampaignRankings }`.

Pure read, no side effects. Returns an empty rankings response
(`{ red: [], blue: [], lastUpdatedAt: null, validatorsCompleted: 0 }`) when
no validator logs exist or contain parseable data.

## Validator "Completed" Status Fix

In `inspectPersistedServiceState` inside `process-manager.ts`, when a process
PID is dead and the `debugLogTail` contains the completion sentinel
`All epochs complete. Validator exiting.`, treat it as a clean exit:

- Status: `"stopped"` (not `"failed"`)
- Clear `lastKnownError`

This applies only when the service key starts with `validator_`.

## Frontend: Leaderboard Page

Convert `/dashboard/leaderboard/page.tsx` from a server component with mock
data to a client component that polls `GET /api/campaign/rankings`.

### Column Definitions

Red Faction:
| Column      | Key               | Source            |
|-------------|-------------------|-------------------|
| #           | rank              | Computed (sorted) |
| UID         | uid               | Parser            |
| Breach Rate | avgScore * 100    | Parser            |
| Weight      | normalizedWeight  | Parser            |

Blue Faction:
| Column   | Key               | Source            |
|----------|-------------------|-------------------|
| #        | rank              | Computed (sorted) |
| UID      | uid               | Parser            |
| F1 Score | avgScore * 100    | Parser            |
| Weight   | normalizedWeight  | Parser            |

### Empty State

When `red` and `blue` arrays are both empty, show:
"No rankings yet — waiting for validators to complete an epoch."

### Polling

Same 3-second interval as the service status poller. Configurable via prop
for testing.

### FactionTable

No changes needed — it is already generic. The leaderboard page passes
different column definitions and live data instead of mock arrays.

## Scope

### In Scope

- `rankings-parser.ts` with unit tests
- `GET /api/campaign/rankings` route with unit tests
- Leaderboard page rewiring (mock -> live)
- Validator completed status fix in `process-manager.ts` with test
- TDD: write failing tests first, then implement

### Out of Scope

- Modifying `validator.py` or any subnet Python code
- Cross-validator score aggregation beyond last-write-wins per UID
- Removing mock data from `data/mock.ts`
- Adding rankings to the Services tab
