# Run All Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch campaign launch from 13 independent miner and validator spawns to one shared `10_run_all.sh` process while keeping the existing UI service cards intact.

**Architecture:** Keep `local_chain` on the current Docker launch path, but treat all miner and validator cards as projections of a single detached `run_all` process. Persist the shared PID and shared log path onto each process-backed service so the existing polling model can continue to normalize status per card.

**Tech Stack:** Next.js server runtime, TypeScript, Node `child_process` and `fs`, Bash localnet scripts

---

### Task 1: Switch Process Launching to `10_run_all.sh`

**Files:**
- Modify: `frontend/lib/campaign/process-manager.ts`

- [ ] Inspect current launch normalization so `local_chain` remains unchanged.
- [ ] Add helpers for identifying miner and validator services and for creating the synthetic shared `run_all` detached launch definition.
- [ ] Update `launchCampaignServices()` so non-running miner and validator services trigger a single detached `10_run_all.sh` spawn and all process-backed cards receive the shared PID and `run_all.log`.
- [ ] Keep existing local chain failure handling so process-backed services do not launch after a Docker startup failure.

### Task 2: Distinguish Clean Group Stops from Crashes

**Files:**
- Modify: `frontend/lib/campaign/process-manager.ts`
- Modify: `subnet/scripts/localnet/10_run_all.sh`

- [ ] Add the `All miners and validators stopped.` sentinel to the shell cleanup path and the natural exit path.
- [ ] Update persisted state inspection so dead miner and validator cards with the shared sentinel are normalized to `stopped` before crash evidence is considered.
- [ ] Preserve the existing validator completion sentinel behavior for validators that finish epochs while the shared group is still alive.

### Task 3: Review Without Running Tests

**Files:**
- Modify: `docs/superpowers/plans/2026-03-30-run-all-launch.md`
- Modify: `frontend/lib/campaign/process-manager.ts`
- Modify: `subnet/scripts/localnet/10_run_all.sh`

- [ ] Read back the edited files and confirm the launch flow matches the approved design.
- [ ] Do not add or run tests, per request.
