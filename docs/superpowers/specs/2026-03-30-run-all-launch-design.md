# Design: Use 10_run_all.sh for Campaign Launch

**Date:** 2026-03-30
**Status:** Approved

## Problem

The campaign control panel currently spawns 13 individual processes (5 red miners, 5 blue miners, 3 validators), each tracked by its own PID. This creates lifecycle fragmentation: validators complete their epochs and exit, but miners keep running with no shared teardown signal. The `10_run_all.sh` script already exists to launch all 13 processes together with coordinated cleanup via a SIGINT trap.

## Goal

When the "Launch Campaign" button is pressed, use `10_run_all.sh` to launch all miners and validators as a single managed group rather than spawning 13 individual processes.

## What Does Not Change

- `local_chain` Docker launch (02_start_chain.sh) is unchanged
- All 13 service cards still appear in the UI with individual status badges
- Preflight checks, polling interval, and launch button behavior are unchanged
- `lib/campaign/types.ts` is unchanged
- `lib/campaign/services.ts` is unchanged (service definitions remain for display)

## Changes

### 1. `subnet/scripts/localnet/10_run_all.sh`

Add a clean-exit sentinel echo to the `cleanup()` function and after the final `wait`:

```bash
cleanup() {
  echo "All miners and validators stopped."
  # ... existing kill loop ...
  exit 0
}
```

Also echo the sentinel before the script exits naturally (after `wait` returns):

```bash
wait 2>/dev/null || true
echo "All miners and validators stopped."
echo "All processes terminated."
exit 0
```

This allows the process-manager to distinguish a clean stop from a crash.

Also change the script lifecycle so it stops the miner processes once all validator processes finish their scoring pass and exit cleanly, rather than waiting indefinitely for miners to end on their own.

### 2. `frontend/lib/campaign/process-manager.ts`

**In `launchCampaignServices()`:**

Replace the per-service loop for process services with a single spawn:

1. Launch `local_chain` via Docker as before (unchanged)
2. Collect all process services (miners + validators) that are not already running
3. If any exist, call `startDetachedService` once using a synthetic service definition pointing to `subnet/scripts/localnet/10_run_all.sh` with `logPath: run_all.log`
4. Write the returned `pid` and `logPath` into every miner and validator service state, all with `status: "starting"`

**In `inspectPersistedServiceState()`:**

Add a miner/validator clean-exit sentinel check that mirrors the existing validator completion check:

```
const RUN_ALL_STOP_SENTINEL = "All miners and validators stopped.";
const isMinerOrValidatorKey = service.key.startsWith("red_miner_") ||
  service.key.startsWith("blue_miner_") ||
  service.key.startsWith("validator_");

if (!healthy && isMinerOrValidatorKey && logContains(RUN_ALL_STOP_SENTINEL)) {
  return { ...normalizedState, status: "stopped", lastKnownError: undefined };
}
```

This runs before the existing crash-evidence check, so a clean group stop shows `"stopped"` not `"failed"`.

The existing validator-specific sentinel (`"All epochs complete. Validator exiting."`) is preserved and unchanged in validator logs. The shared `run_all` lifecycle now exits cleanly once all validators have completed, so miners and validators all transition to `"stopped"` together after weights are assigned.

## Data Flow

### Launch

```
Button press
  → POST /api/campaign/launch
  → launchCampaignServices()
  → Docker: start local_chain (unchanged)
  → spawn 10_run_all.sh once → { pid: 12345, logPath: run_all.log }
  → write pid=12345, logPath=run_all.log into all 13 service states
  → return snapshot (all 13 show "starting")
```

### Status Polling (every 3s)

```
GET /api/campaign/status
  → inspectPersistedServiceState() for each service
  → isProcessAlive(12345)  ← same PID for all 13
  → alive  → "running"
  → dead + sentinel in log  → "stopped"
  → dead + no sentinel      → "failed"
```

### Teardown

- **User kills session** (Ctrl+C on run_all): `cleanup()` fires, echoes sentinel, kills all children → all 13 cards flip to `"stopped"`
- **Validators complete epochs cleanly**: `10_run_all.sh` detects that all validator processes have exited, kills the miners, echoes the stop sentinel, and all 13 cards flip to `"stopped"`
- **Validator exits abnormally**: `10_run_all.sh` tears down the remaining children without the clean-stop sentinel, so polling reports the shared group as failed

## Files Modified

| File | Change |
|------|--------|
| `subnet/scripts/localnet/10_run_all.sh` | Add clean-exit sentinel handling and stop miners once validators finish |
| `frontend/lib/campaign/process-manager.ts` | Spawn 10_run_all.sh once instead of 13 individual processes; add stop sentinel check |

## Files Not Modified

- `frontend/lib/campaign/types.ts`
- `frontend/lib/campaign/services.ts`
- `frontend/components/campaigns/TargetSetup.tsx`
- `frontend/app/api/campaign/launch/route.ts`
- `frontend/app/api/campaign/status/route.ts`
- All miner and validator run scripts (07_, 08_, 09_)
