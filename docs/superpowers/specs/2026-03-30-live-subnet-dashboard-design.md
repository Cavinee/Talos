# Live Subnet Dashboard & 3-Validator / 10-Miner Scale-Up Design

**Date:** 2026-03-30

## Goal

Scale the localnet from 1 validator + 2 miners to 3 validators + 10 miners (5 red, 5 blue), fix the emission gap caused by the single-epoch validator, and replace all frontend mock data with live data read from the running subnet.

---

## Part 1: Subnet Scale-Up (cherry-pick)

Cherry-pick commit `60c83d0` from `feat/scale-mock-miners-validators` onto the current branch. This brings:

- `03_create_wallets.sh` — creates `test-validator-{1..3}`, `test-red-miner-{1..5}`, `test-blue-miner-{1..5}`
- `04_fund_wallets.sh` — funds all 13 wallets
- `06_register_neurons.sh` — registers all 13 neurons
- `07_stake_validators.sh` — stakes all 3 validators
- `06_register_and_stake.sh` — wrapper calling registration then staking
- `07_run_red_miner.sh <INDEX>` — runs red miner by index (port 8091–8095)
- `08_run_blue_miner.sh <INDEX>` — runs blue miner by index (port 8096–8100)
- `09_run_validator.sh <INDEX>` — runs validator by index
- `10_run_all.sh` — launches all 13 processes with cleanup trap
- `register_subnet_neuron.py` — Python helper for registration
- `mock_data.py` — mock prompt pool and judge replacing LLM calls
- `validator.py` — multi-epoch mode (10 epochs), file-locked concurrent writes, epoch pairings

**Emission fix:** The old validator ran one epoch and exited. The new validator runs 10 epochs, sets weights once at the end based on average scores across all pairings, and exits. Because all 3 validators run concurrently, weights are set 3× per run cycle.

---

## Part 2: Validator Enriched Output

After cherry-pick, extend `validator.py` to write two JSON files that feed the frontend.

### `threat_stream.json`

Written by `run_epoch` — one entry per prompt that was evaluated by the blue miner. Appended with file-locking (same pattern as `dangerous_prompts.json`).

Schema:
```json
{
  "id": "t-<8-char uuid hex>",
  "timestamp": "YYYY-MM-DD HH:MM:SS",
  "payload": "<first 60 chars of prompt>",
  "redPrompt": "<full prompt text>",
  "attackType": "prompt_injection | jailbreak | role_hijack | DAN",
  "threatScore": 0-100,
  "blueClassification": "dangerous | safe",
  "redMiner": { "uid": "test-red-miner-N", "rank": 0 },
  "blueMiner": { "uid": "test-blue-miner-N", "rank": 0 },
  "status": "blocked | passed | flagged"
}
```

Category → attackType mapping:
- `secret_extraction` → `"prompt_injection"`
- `prompt_leak` → `"role_hijack"`
- `jailbreak` → `"jailbreak"`

threatScore: `round(is_dangerous * 60 + random(0,40))` — high if judge says unsafe, low otherwise.

status logic:
- blue said `"dangerous"` → `"blocked"`
- blue said `"safe"` AND judge says unsafe → `"passed"` (breach)
- blue said `"safe"` AND judge says safe → benign, skip entry (not a threat)

### `rankings.json`

Written once after all epochs complete (with file-locking). Validator accumulates per-miner stats during the epoch loop.

Schema:
```json
{
  "lastUpdated": "<ISO 8601>",
  "red": [
    {
      "rank": 1,
      "uid": "test-red-miner-N",
      "avgScore": 0.85,
      "severity": 8.5,
      "novelty": 8.1,
      "combinedScore": 16.6
    }
  ],
  "blue": [
    {
      "rank": 1,
      "uid": "test-blue-miner-N",
      "precision": 95.0,
      "recall": 94.0,
      "latency": 10.0,
      "avgF1": 0.945
    }
  ]
}
```

Derived fields:
- `severity = avgScore * 10` (red only)
- `novelty = avgScore * 9.5` (red only)
- `combinedScore = severity + novelty`
- `precision`, `recall` accumulated per miner across epochs; `latency` is mock (fixed per miner index, e.g. `8 + index * 0.7`)
- Ranks assigned by descending `avgScore`

Multiple validators write concurrently — use same file-lock pattern. Each validator merges its miner scores into the existing file rather than overwriting.

---

## Part 3: Next.js API Routes

New files under `frontend/app/api/`:

### `threats/route.ts`

```
GET /api/threats?limit=50
```
- Reads `path.join(process.cwd(), '..', 'subnet', 'threat_stream.json')`
- Returns last `limit` entries sorted newest-first
- Returns `{ threats: [] }` if file missing
- No auth, localhost only

### `rankings/route.ts`

```
GET /api/rankings
```
- Reads `path.join(process.cwd(), '..', 'subnet', 'rankings.json')`
- Returns `{ red: [], blue: [], lastUpdated: null }` if file missing

---

## Part 4: Frontend Live Data

### `hooks/useLiveData.ts`

Generic polling hook:
```ts
useLiveData<T>(url: string, fallback: T, intervalMs: number): { data: T, loading: boolean, error: string | null }
```
Uses `useEffect` + `setInterval`. Fetches on mount, then polls. Cleans up interval on unmount.

### Dashboard page updates

- Replace `import { threatStream } from "@/data/mock"` with `useLiveData("/api/threats", { threats: [] }, 5000)`
- Compute `DashboardMetrics` from live threat array:
  - `totalDetected = threats.length`
  - `totalBlocked = threats.filter(t => t.status === "blocked").length`
  - `blockRate = totalBlocked / totalDetected * 100`
  - `sdkLatency`: keep static (11.3ms) until validator emits it
  - `falsePositiveRate`: `FP / (FP + TN) * 100` where FP = safe prompt classified dangerous
- MetricCard values become computed from live data

### Leaderboard page updates

- Replace `redFaction` / `blueFaction` mock imports with `useLiveData("/api/rankings", { red: [], blue: [] }, 10000)`
- FactionTable already accepts generic `data` — no component changes needed

### `frontend/data/mock.ts`

- Trim `redFaction` to 5 entries, `blueFaction` to 5 entries (matching actual localnet miners)
- Keep `threatStream`, `dashboardMetrics`, `sandboxStages`, `codeSnippets`, `landingFeatures`, `landingStats`, `partnerLogos` as-is (used by landing page, not replaced by live data)

---

## Testing

- Run `10_run_all.sh`, wait for first epoch, verify `threat_stream.json` and `rankings.json` are written
- Hit `/api/threats` and `/api/rankings` manually to confirm correct shape
- Open dashboard and leaderboard — confirm live data appears and refreshes

## Out of scope

- Auth on API routes (localhost dev only)
- WebSocket / SSE (polling is sufficient)
- Chain querying from frontend
- Persistent database
