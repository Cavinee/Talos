# Campaign Localnet Control Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the frontend baseline verification issues, then turn the campaign page into a real localnet control panel that launches the local chain, red miner, blue miner, and validator and shows their live status.

**Architecture:** The Next.js app will own a small server-side control plane under `frontend/app/api/campaign/*` backed by a focused process manager module that persists runtime metadata in `frontend/.runtime/`. The client campaign page will keep the API URL as inert UI state for now, call the launch endpoint, and poll the status endpoint to render the four managed services.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Node `child_process`/`fs`, Docker CLI, ESLint flat config, Vitest, Testing Library

---

### Task 1: Fix Frontend Baseline and Add Test Harness

**Files:**
- Modify: `frontend/app/layout.tsx`
- Modify: `frontend/styles/globals.css`
- Modify: `frontend/tailwind.config.ts`
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Create: `frontend/eslint.config.mjs`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/vitest.setup.ts`

- [ ] **Step 1: Write the failing baseline verification checks**

Run:

```bash
cd /Users/cavine/Code/Talos/.worktrees/codex-campaign-localnet-control-panel/frontend && npm run lint
cd /Users/cavine/Code/Talos/.worktrees/codex-campaign-localnet-control-panel/frontend && npm run build
```

Expected:
- `npm run lint` fails by prompting for ESLint setup because no config file exists.
- `npm run build` fails because `next/font/google` cannot fetch `Inter` and `JetBrains Mono` from Google Fonts.

- [ ] **Step 2: Install the test dependencies**

Run:

```bash
cd /Users/cavine/Code/Talos/.worktrees/codex-campaign-localnet-control-panel/frontend && npm install -D vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Expected:
- The lockfile updates successfully.

- [ ] **Step 3: Add the minimal lint and test tooling**

Create `frontend/eslint.config.mjs` with a flat config that composes the Next.js core web vitals and TypeScript-friendly defaults for this repo.

Create `frontend/vitest.config.ts` with:
- `environment: "jsdom"`
- a setup file at `./vitest.setup.ts`
- path alias support for `@/*`

Create `frontend/vitest.setup.ts` to register `@testing-library/jest-dom`.

Update `frontend/package.json` scripts to include:

```json
{
  "lint": "eslint .",
  "test": "vitest run"
}
```

- [ ] **Step 4: Replace network-fetched fonts with local CSS font stacks**

Update `frontend/app/layout.tsx` to remove `next/font/google` usage entirely.

Update `frontend/styles/globals.css` to define:
- `--font-sans` with a local serif-forward stack that fits the existing visual language
- `--font-mono` with a local monospace stack

Update `frontend/tailwind.config.ts` so Tailwind’s `font-sans` and `font-mono` map to the new local CSS variables rather than the removed Google font variables.

Ensure `body` uses the local `--font-sans` stack and code-like surfaces can use `--font-mono`.

- [ ] **Step 5: Verify the baseline now passes**

Run:

```bash
cd /Users/cavine/Code/Talos/.worktrees/codex-campaign-localnet-control-panel/frontend && npm run lint
cd /Users/cavine/Code/Talos/.worktrees/codex-campaign-localnet-control-panel/frontend && npm run build
```

Expected:
- Lint completes without interactive prompts.
- Build succeeds without fetching Google Fonts.

### Task 2: Build the Server-Side Campaign Control Plane

**Files:**
- Create: `frontend/lib/campaign/types.ts`
- Create: `frontend/lib/campaign/process-manager.ts`
- Create: `frontend/app/api/campaign/status/route.ts`
- Create: `frontend/app/api/campaign/launch/route.ts`
- Create: `frontend/lib/campaign/__tests__/process-manager.test.ts`
- Create: `frontend/app/api/campaign/__tests__/routes.test.ts`
- Modify: `frontend/.gitignore`

- [ ] **Step 1: Write the failing server tests**

Create `frontend/lib/campaign/__tests__/process-manager.test.ts` covering:
- a healthy already-running service is not relaunched
- stale pid metadata is replaced
- failed launches are surfaced as `failed`
- status normalization includes `local_chain`, `red_miner`, `blue_miner`, and `validator`

Create `frontend/app/api/campaign/__tests__/routes.test.ts` covering:
- `GET /api/campaign/status` returns the normalized snapshot from the manager
- `POST /api/campaign/launch` triggers launch and returns all service states

Mock Docker inspection, child-process spawning, pid liveness checks, and runtime-state file helpers in these tests so they verify state transitions and route payloads without starting real long-running services.

Run:

```bash
cd /Users/cavine/Code/Talos/.worktrees/codex-campaign-localnet-control-panel/frontend && npm test -- frontend/lib/campaign/__tests__/process-manager.test.ts frontend/app/api/campaign/__tests__/routes.test.ts
```

Expected:
- Tests fail because the campaign manager and route handlers do not exist yet.

- [ ] **Step 2: Implement the campaign types and persisted runtime state**

Create `frontend/lib/campaign/types.ts` with the shared service identifiers and API-facing status types:
- `CampaignServiceId`
- `CampaignServiceStatus`
- `CampaignServiceSnapshot`
- `CampaignLaunchResponse`

In `frontend/lib/campaign/process-manager.ts`, define:
- the runtime directory path under `frontend/.runtime/`
- the runtime state file path
- helpers to read/write state safely
- a persisted state shape that records, per service:
  - process pid or Docker container identifier
  - launch time
  - script path or command label
  - log path when available
  - last known error
- one service definition per managed service including command metadata and human label

Update `frontend/.gitignore` to ignore the runtime directory and any service log output.

- [ ] **Step 3: Implement service launch and health inspection**

In `frontend/lib/campaign/process-manager.ts`, add:
- Docker-backed health checks for `local_chain`
- process liveness checks for the Python services
- start helpers that use the existing shell scripts:
  - `subnet/scripts/localnet/02_start_chain.sh`
  - `subnet/scripts/localnet/07_run_red_miner.sh`
  - `subnet/scripts/localnet/08_run_blue_miner.sh`
  - `subnet/scripts/localnet/09_run_validator.sh`
- sequential `launchCampaignServices()` logic
- read-only `getCampaignServiceSnapshot()` logic

Use detached child processes for the Python workers and persist pid/log metadata after successful spawn.

- [ ] **Step 4: Implement the route handlers**

Create:
- `frontend/app/api/campaign/status/route.ts`
- `frontend/app/api/campaign/launch/route.ts`

Each route should:
- import the shared manager
- return JSON shaped for the client UI
- catch unexpected errors and return a usable failure payload rather than an empty 500 response

- [ ] **Step 5: Verify the server control plane**

Run:

```bash
cd /Users/cavine/Code/Talos/.worktrees/codex-campaign-localnet-control-panel/frontend && npm test -- frontend/lib/campaign/__tests__/process-manager.test.ts frontend/app/api/campaign/__tests__/routes.test.ts
cd /Users/cavine/Code/Talos/.worktrees/codex-campaign-localnet-control-panel/frontend && npm run lint
```

Expected:
- The new server tests pass.
- Lint remains green.

### Task 3: Wire the Campaign Page to Launch and Monitor Services

**Files:**
- Modify: `frontend/components/campaigns/TargetSetup.tsx`
- Modify: `frontend/components/campaigns/SandboxStatus.tsx`
- Modify: `frontend/app/dashboard/campaigns/page.tsx`
- Create: `frontend/components/campaigns/__tests__/TargetSetup.test.tsx`

- [ ] **Step 1: Write the failing client test**

Create `frontend/components/campaigns/__tests__/TargetSetup.test.tsx` covering:
- typing into the `Client API URL` field preserves the value locally
- clicking `Launch Campaign` calls the launch endpoint
- the component renders service rows from the returned status payload
- polling refreshes the service state after launch
- failure text is rendered when a service reports `failed`

Run:

```bash
cd /Users/cavine/Code/Talos/.worktrees/codex-campaign-localnet-control-panel/frontend && npm test -- frontend/components/campaigns/__tests__/TargetSetup.test.tsx
```

Expected:
- The test fails because the component is still static and has no launch/status behavior.

- [ ] **Step 2: Implement the interactive campaign control UI**

Update `frontend/components/campaigns/TargetSetup.tsx` to:
- keep the API URL as local component state
- fetch `GET /api/campaign/status` on mount so the page rehydrates service state after refresh
- call `POST /api/campaign/launch` on button click
- poll `GET /api/campaign/status` after launch
- render one visible service row/card for `local_chain`, `red_miner`, `blue_miner`, and `validator`
- show `running`, `starting`, `stopped`, and `failed` badges
- show concise detail or error text per service
- disable or relabel the button while launch is in flight

Use a small internal helper or extracted function for polling state transitions if it keeps the file readable, but do not add unrelated abstractions.

- [ ] **Step 3: Align the surrounding page copy and layout**

Update `frontend/components/campaigns/SandboxStatus.tsx` or the page composition so the old mock provisioning cards no longer conflict with the new real service status panel. The final page should present one coherent operator flow rather than two competing status surfaces.

Update `frontend/app/dashboard/campaigns/page.tsx` only as needed to support the new composition cleanly.

- [ ] **Step 4: Verify the client behavior**

Run:

```bash
cd /Users/cavine/Code/Talos/.worktrees/codex-campaign-localnet-control-panel/frontend && npm test -- frontend/components/campaigns/__tests__/TargetSetup.test.tsx
cd /Users/cavine/Code/Talos/.worktrees/codex-campaign-localnet-control-panel/frontend && npm run lint
cd /Users/cavine/Code/Talos/.worktrees/codex-campaign-localnet-control-panel/frontend && npm run build
```

Expected:
- The component test passes.
- Lint passes.
- Build passes with the new campaign UI and API routes in place.

### Task 4: Final Integration Verification

**Files:**
- No planned code changes unless verification exposes a targeted defect.

- [ ] **Step 1: Run the full frontend test suite**

Run:

```bash
cd /Users/cavine/Code/Talos/.worktrees/codex-campaign-localnet-control-panel/frontend && npm test
```

Expected:
- All frontend tests pass.

- [ ] **Step 2: Run the final verification commands**

Run:

```bash
cd /Users/cavine/Code/Talos/.worktrees/codex-campaign-localnet-control-panel/frontend && npm run lint
cd /Users/cavine/Code/Talos/.worktrees/codex-campaign-localnet-control-panel/frontend && npm run build
```

Expected:
- Lint passes.
- Build passes.

- [ ] **Step 3: Manual spot check**

Document the expected manual flow for the user:
- open the campaign page
- enter any API URL text
- click `Launch Campaign`
- observe service cards for the chain, red miner, blue miner, and validator
- refresh the page and confirm the service panel rehydrates from `GET /api/campaign/status`
- click `Launch Campaign` again and confirm the service list stays single-instance rather than duplicating workers

If time allows and the environment permits, run the app locally and verify the page behavior manually. If the environment does not permit real process startup, note that limitation clearly in the handoff.
