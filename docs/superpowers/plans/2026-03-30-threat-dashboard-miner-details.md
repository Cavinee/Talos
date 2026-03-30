# Threat Dashboard Miner Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a row-selected threat details inspector to the dashboard that shows each selected red miner prompt, the blue miner's classification for that prompt, and both miners' metadata without overcrowding the main threat table.

**Architecture:** Keep the existing dashboard page and threat table, but convert the table into a controlled selectable list and add a dedicated `ThreatDetailsPanel` component. Expand the mock threat records so each row carries its own full detail payload, then render a desktop side panel plus a mobile slide-over view from the same selected-threat state.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Framer Motion, Vitest, React Testing Library

**Execution note:** User approved the design spec at `docs/superpowers/specs/2026-03-30-threat-dashboard-miner-details-design.md`. Work remains on the current branch `codex-campaign-localnet-control-panel`; do not create a new worktree unless the user asks.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/package.json` | Modify | Add frontend test scripts and test-only dev dependencies |
| `frontend/package-lock.json` | Modify | Lock the new frontend test dependencies |
| `frontend/vitest.config.ts` | Create | Configure Vitest with jsdom and the `@/*` alias |
| `frontend/vitest.setup.ts` | Create | Load `@testing-library/jest-dom` and any lightweight test setup |
| `frontend/app/dashboard/page.tsx` | Modify | Own selected-threat state and render the table plus details panel layout |
| `frontend/app/dashboard/page.test.tsx` | Create | Cover default selection, row switching, and detail rendering |
| `frontend/components/dashboard/ThreatTable.tsx` | Modify | Accept controlled selection props and render active-row styling |
| `frontend/components/dashboard/ThreatDetailsPanel.tsx` | Create | Render the selected threat's prompt, classification, miner details, empty state, and mobile close affordance |
| `frontend/data/mock.ts` | Modify | Expand `ThreatEntry` records with prompt, classification, and miner detail payloads |

---

## Task 1: Prepare Frontend Test Tooling

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/vitest.setup.ts`
- Create: `frontend/app/dashboard/page.test.tsx`

- [ ] **Step 1: Add the frontend test dependencies and scripts**

Add `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, and `@testing-library/user-event` as frontend dev dependencies.

Add a `test` script to `frontend/package.json`:

```json
"test": "vitest run"
```

- [ ] **Step 2: Configure Vitest for the Next.js frontend**

Create `frontend/vitest.config.ts` with a jsdom test environment, a setup file, and an alias mapping for `@/*` to `./`.

Create `frontend/vitest.setup.ts` to import `@testing-library/jest-dom`.

- [ ] **Step 3: Add a smoke test for the existing dashboard page**

Create `frontend/app/dashboard/page.test.tsx` with a minimal render test that asserts the heading `Threat Intelligence Dashboard` is visible. This proves the test harness can render the page component before feature-specific assertions are added.

- [ ] **Step 4: Run the targeted frontend test to verify the harness works**

Run: `cd /Users/cavine/Code/Talos/frontend && npm run test -- app/dashboard/page.test.tsx`
Expected: PASS with a single smoke test.

- [ ] **Step 5: Commit the test harness scaffold**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vitest.config.ts frontend/vitest.setup.ts frontend/app/dashboard/page.test.tsx
git commit -m "test: add frontend dashboard test harness"
```

---

## Task 2: Add Selectable Threat Records And Desktop Inspector Behavior

**Files:**
- Modify: `frontend/data/mock.ts`
- Modify: `frontend/components/dashboard/ThreatTable.tsx`
- Create: `frontend/components/dashboard/ThreatDetailsPanel.tsx`
- Modify: `frontend/app/dashboard/page.tsx`
- Modify: `frontend/app/dashboard/page.test.tsx`

- [ ] **Step 1: Write the failing dashboard interaction test**

Extend `frontend/app/dashboard/page.test.tsx` to assert all of the following:

- the newest threat record is selected by default
- the details panel renders the selected threat's full red prompt
- the details panel renders the blue miner classification for the selected threat
- the details panel renders both red and blue miner metadata
- clicking a different table row updates the panel content

Use the existing `threatStream` data as the source of truth for the expected prompt text and miner labels.

- [ ] **Step 2: Run the targeted test to verify it fails for the right reason**

Run: `cd /Users/cavine/Code/Talos/frontend && npm run test -- app/dashboard/page.test.tsx`
Expected: FAIL because the dashboard does not yet expose a selected-threat details panel or row-selection behavior.

- [ ] **Step 3: Expand the mock threat entry shape**

Update `frontend/data/mock.ts` so `ThreatEntry` includes:

- `redPrompt: string`
- `blueClassification: "dangerous" | "safe" | "unknown"`
- `redMiner: { uid: string; rank: number; severity: number; novelty: number; combinedScore: number }`
- `blueMiner: { uid: string; rank: number; precision: number; recall: number; latency: number }`

Populate every `threatStream` item with realistic seeded values. Keep `payload` as the short list summary and store the full detail text in `redPrompt`.

- [ ] **Step 4: Convert the threat table into a controlled selectable table**

Refactor `frontend/components/dashboard/ThreatTable.tsx` to accept:

```ts
entries: ThreatEntry[]
selectedThreatId: string | null
onSelectThreat: (threatId: string) => void
```

Render rows from `entries` instead of importing `threatStream` directly. Add visible active-row styling and an accessible selected state such as `aria-selected={entry.id === selectedThreatId}`. Preserve the existing compact table columns and animations.

- [ ] **Step 5: Build the new details panel component**

Create `frontend/components/dashboard/ThreatDetailsPanel.tsx` to render:

- the selected prompt text
- the blue classification verdict
- a red miner details section
- a blue miner details section
- an empty-state fallback when no threat is available

The component should accept the selected `ThreatEntry | null` plus an optional `onClose` callback for mobile use later.

- [ ] **Step 6: Integrate selection state into the dashboard page**

Update `frontend/app/dashboard/page.tsx` so it:

- imports `threatStream`
- initializes selection to `threatStream[0]?.id ?? null`
- derives the selected threat from that id
- renders the table and inspector in a two-column layout on large screens

Keep the existing metric cards and shield status unchanged.

- [ ] **Step 7: Run the targeted test to verify the new behavior passes**

Run: `cd /Users/cavine/Code/Talos/frontend && npm run test -- app/dashboard/page.test.tsx`
Expected: PASS

- [ ] **Step 8: Run lint for the updated frontend files**

Run: `cd /Users/cavine/Code/Talos/frontend && npm run lint`
Expected: PASS

- [ ] **Step 9: Commit the desktop inspector feature**

```bash
git add frontend/data/mock.ts frontend/components/dashboard/ThreatTable.tsx frontend/components/dashboard/ThreatDetailsPanel.tsx frontend/app/dashboard/page.tsx frontend/app/dashboard/page.test.tsx
git commit -m "feat: add selectable threat details panel"
```

---

## Task 3: Add Mobile Slide-Over Behavior And Fallback States

**Files:**
- Modify: `frontend/components/dashboard/ThreatDetailsPanel.tsx`
- Modify: `frontend/app/dashboard/page.tsx`
- Modify: `frontend/app/dashboard/page.test.tsx`

- [ ] **Step 1: Write the failing test for fallback and close behavior**

Extend `frontend/app/dashboard/page.test.tsx` with assertions that:

- the details panel renders an explicit fallback such as `Classification unavailable` when `blueClassification` is `unknown`
- the details panel exposes a close control for the mobile slide-over variant

If the page-level test becomes awkward, split the fallback checks into a focused `ThreatDetailsPanel` test file instead of overloading the page test.

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `cd /Users/cavine/Code/Talos/frontend && npm run test -- app/dashboard/page.test.tsx`
Expected: FAIL because the fallback copy and mobile close affordance do not exist yet.

- [ ] **Step 3: Implement the mobile slide-over controls**

Update `frontend/app/dashboard/page.tsx` and `frontend/components/dashboard/ThreatDetailsPanel.tsx` so that:

- desktop keeps a visible side panel
- mobile uses a fixed-position slide-over panel
- row selection opens the mobile panel
- a close button dismisses the mobile panel without clearing the selected threat

Keep the default selected threat in state for desktop, but do not force the mobile slide-over open on first render. Use a separate `isMobilePanelOpen` boolean so mobile can stay collapsed until the user taps a row.

- [ ] **Step 4: Implement clear fallback states**

Show stable copy when fields are missing:

- missing classification: `Classification unavailable`
- missing miner metadata: `Miner details unavailable`
- no selected threat: `Select a threat to inspect miner details`

- [ ] **Step 5: Run the targeted tests to verify they pass**

Run: `cd /Users/cavine/Code/Talos/frontend && npm run test -- app/dashboard/page.test.tsx`
Expected: PASS

- [ ] **Step 6: Run lint again after the responsive and fallback changes**

Run: `cd /Users/cavine/Code/Talos/frontend && npm run lint`
Expected: PASS

- [ ] **Step 7: Commit the responsive inspector polish**

```bash
git add frontend/components/dashboard/ThreatDetailsPanel.tsx frontend/app/dashboard/page.tsx frontend/app/dashboard/page.test.tsx
git commit -m "feat: polish threat details panel states"
```

---

## Task 4: Final Verification

**Files:**
- No planned source changes unless verification uncovers defects

- [ ] **Step 1: Run the full frontend test suite**

Run: `cd /Users/cavine/Code/Talos/frontend && npm run test`
Expected: PASS

- [ ] **Step 2: Run the frontend linter**

Run: `cd /Users/cavine/Code/Talos/frontend && npm run lint`
Expected: PASS

- [ ] **Step 3: Perform manual dashboard verification**

Check all of the following in the browser:

- the dashboard loads with the existing metrics and shield status unchanged
- the newest threat is selected in the desktop view by default
- clicking rows updates the details panel prompt, classification, and miner metadata
- the mobile-width layout opens the slide-over only after row selection
- the mobile close control dismisses the slide-over cleanly
- fallback copy is visible if the selected threat has missing detail fields

- [ ] **Step 4: Record any verification fixes before merging**

If manual verification uncovers layout or state issues, add a small follow-up test first, then make the minimal code change, rerun `npm run test`, rerun `npm run lint`, and commit with a focused message.
