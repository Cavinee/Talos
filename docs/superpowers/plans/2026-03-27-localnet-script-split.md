# Localnet Script Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate neuron registration and validator staking into dedicated localnet scripts while keeping the combined script as a convenience wrapper.

**Architecture:** Add one registration phase script and one staking phase script, then reduce the combined script to orchestration only. Keep the current environment-variable interface unchanged so the Python helpers and runbook stay familiar.

**Tech Stack:** Bash, Python helpers already in the repo, `unittest`

**Execution note:** User explicitly asked to stay on the current branch and not create a git worktree for this task.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `subnet/scripts/localnet/06_register_neurons.sh` | Create | Register validator and miner wallets on the subnet |
| `subnet/scripts/localnet/07_stake_validators.sh` | Create | Stake the validator wallets in rounds |
| `subnet/scripts/localnet/06_register_and_stake.sh` | Modify | Wrapper that calls registration then staking |
| `subnet/tests/test_localnet_scripts.py` | Modify | Assert the new scripts exist and contain the expected commands |
| `subnet/README.md` | Modify | Document the split commands and keep the wrapper flow clear |
| `subnet/scripts/localnet/bootstrap_localnet.sh` | Modify | Keep setup text aligned with the wrapper and split phases if needed |

---

## Task 1: Split Localnet Registration And Staking Scripts

**Files:**
- Create: `subnet/scripts/localnet/06_register_neurons.sh`
- Create: `subnet/scripts/localnet/07_stake_validators.sh`
- Modify: `subnet/scripts/localnet/06_register_and_stake.sh`
- Modify: `subnet/tests/test_localnet_scripts.py`
- Modify: `subnet/README.md`
- Modify: `subnet/scripts/localnet/bootstrap_localnet.sh` (only if the runbook text needs adjustment)

- [ ] **Step 1: Write the failing test**

Update `subnet/tests/test_localnet_scripts.py` so it expects the new split scripts to exist, checks that the registration script contains the wallet registration loops, checks that the staking script contains the validator staking loop, and checks that `06_register_and_stake.sh` delegates to both scripts by path instead of embedding both phases inline.

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `cd /Users/cavine/Code/Talos/subnet && python3 -m unittest tests.test_localnet_scripts`
Expected: FAIL because the new script files and wrapper expectations do not exist yet.

- [ ] **Step 3: Implement the minimal script split**

Create `subnet/scripts/localnet/06_register_neurons.sh` by moving the registration helper function and registration loops there.

Create `subnet/scripts/localnet/07_stake_validators.sh` by moving the validator staking loop there and preserving `NETWORK`, `NETUID`, and `VALIDATOR_STAKE_AMOUNT`.

Reduce `subnet/scripts/localnet/06_register_and_stake.sh` to a thin wrapper that locates `SCRIPT_DIR` and executes the new registration script followed by the new staking script.

- [ ] **Step 4: Preserve executable permissions**

Ensure both new shell scripts are executable so they can be invoked directly by the wrapper and bootstrap flow.

- [ ] **Step 5: Update docs to match the new flow**

Update `subnet/README.md` to show both split phase scripts and make clear that `06_register_and_stake.sh` remains available as a convenience wrapper.

Update `subnet/scripts/localnet/bootstrap_localnet.sh` only if its wording needs to reference the split explicitly while keeping behavior unchanged.

- [ ] **Step 6: Run the targeted tests to verify they pass**

Run: `cd /Users/cavine/Code/Talos/subnet && python3 -m unittest tests.test_localnet_scripts`
Expected: PASS

- [ ] **Step 7: Self-review**

Check that:
- the wrapper only orchestrates;
- env vars are preserved across scripts;
- no miner/validator counts changed accidentally;
- docs mention both the split scripts and the wrapper.
