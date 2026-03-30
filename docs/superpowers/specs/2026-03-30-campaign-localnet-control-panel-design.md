# Campaign Localnet Control Panel Design

## Summary

Turn the existing campaign target configuration page into a localnet control panel. In this first version, the `Client API URL` field remains stored UI state only and is not used to drive inference requests. Clicking `Launch Campaign` should assume wallets and subnet setup already exist, ensure the local chain/container plus the `red_miner`, `blue_miner`, and `validator` processes are running, and then show live status for all of them on the same page.

## Goals

- Reuse the existing campaign page instead of creating a separate operator surface.
- Start the local runtime stack from the frontend using real backend actions rather than mocked UI state.
- Show live, refresh-safe process status for the local chain/container, red miner, blue miner, and validator.
- Keep the design idempotent so repeated launches do not create duplicate long-running processes.

## Non-Goals

- Creating wallets, funding wallets, creating the subnet, or registering/staking neurons.
- Using the `Client API URL` value to make inference requests in this version.
- Replacing the existing miner and validator shell scripts.
- Building a separate Python control daemon.

## Recommended Approach

Use Next.js API routes inside the frontend app as a lightweight local control plane. This keeps the UI and operator actions in one deployable app, avoids introducing another service, and lets the frontend reuse the existing shell scripts in `subnet/scripts/localnet/`.

## Architecture

### Frontend

The campaign page at `frontend/app/dashboard/campaigns/page.tsx` continues to render `TargetSetup`, but `TargetSetup` becomes a stateful control surface with three concerns:

- capture and retain the `Client API URL` text field value for future use
- invoke a launch endpoint when the user clicks `Launch Campaign`
- poll a status endpoint and render the status of the managed localnet processes

The process panel should live directly under the existing form so the page remains the single place to launch and monitor a campaign.

### Backend Control Plane

Add Next.js route handlers under `frontend/app/api/campaign/`:

- `POST /api/campaign/launch`
  Starts the managed services if they are not already running and returns a normalized status snapshot.
- `GET /api/campaign/status`
  Returns the current normalized status snapshot without mutating state.

Both routes should delegate to a shared server-only utility module rather than embed process logic inside the route files.

### Shared Process Manager

Add a server utility module in the frontend codebase that owns:

- the canonical process definitions for `local_chain`, `red_miner`, `blue_miner`, and `validator`
- the startup command for each managed service
- service-specific health checks
- persistence of pid/log metadata so page refreshes do not lose state
- normalization into a single UI-facing status shape

This module should be the only place that knows how to start, inspect, and describe the managed services.

## Process Model

### Managed Services

The control plane manages four visible services:

- `local_chain`
  Backed by the Docker container started by `subnet/scripts/localnet/02_start_chain.sh`
- `red_miner`
  Backed by `subnet/scripts/localnet/07_run_red_miner.sh`
- `blue_miner`
  Backed by `subnet/scripts/localnet/08_run_blue_miner.sh`
- `validator`
  Backed by `subnet/scripts/localnet/09_run_validator.sh`

### Launch Order

`Launch Campaign` should launch or verify services in this order:

1. check whether the local chain container is already running
2. start the chain if needed
3. start `red_miner` if needed
4. start `blue_miner` if needed
5. start `validator` if needed
6. return a combined snapshot for all services

This gives the UI deterministic progress and makes failures easier to explain.

### Idempotency

Each service start must be guarded by an existing-state check. If a service is already healthy, the control plane should report it as already running instead of starting a second copy. If metadata exists but the process is gone, the control plane should treat that service as stopped and cleanly replace the stale metadata.

## Status Semantics

Expose a small fixed status model to the frontend:

- `running`
  The service is alive and has passed its health check.
- `starting`
  The service was launched or detected recently but has not yet passed a stable health check.
- `stopped`
  The service is not running.
- `failed`
  The latest launch attempt failed or the process exited unexpectedly.

Each service payload should also include concise operator-friendly details such as:

- pid where relevant
- container name for `local_chain`
- port or command summary where helpful
- a short last error or last known log hint if startup failed

## Health Checks

Use service-specific checks rather than one generic rule:

- `local_chain`
  Docker container existence and running state should be the source of truth.
- `red_miner`
  Confirm the tracked process is alive and optionally verify the expected command metadata.
- `blue_miner`
  Confirm the tracked process is alive and optionally verify the expected command metadata.
- `validator`
  Confirm the tracked process is alive and optionally verify the expected command metadata.

The first version does not need deep protocol-level readiness checks; process liveness plus container state is enough.

## Persistence

Store runtime metadata in a small local state file inside the frontend workspace, for example under a dedicated runtime directory such as `frontend/.runtime/`. The file should record each managed service's pid or container identifier, launch time, script path, and last known error. This allows:

- page refresh survival
- status polling without keeping data only in memory
- cleanup of stale process metadata

The runtime file should be treated as local operational state and ignored by git.

## UI Design

`TargetSetup` should evolve into the following flow:

1. user types any value into `Client API URL`
2. user clicks `Launch Campaign`
3. button enters loading state while launch is in progress
4. process status panel appears or refreshes below the form
5. panel continues polling the status endpoint for updates

The panel should render one row or card per service with:

- service name
- status badge
- short detail text
- visible failure text when applicable

The page should be resilient to partial success. If the chain and two workers start but one worker fails, the UI should still show all services and mark only the failing service as `failed`.

## Error Handling

- A second click on `Launch Campaign` must not duplicate processes.
- If a start step fails, the response should still include the statuses of all services.
- If a tracked process exits between polls, the next status response should downgrade it to `failed` or `stopped` based on the available launch history.
- If the local environment is missing a dependency such as Docker or the Python environment, surface a concise failure detail rather than a generic 500-only experience.

## Testing Strategy

### Server Tests

Add focused tests for the process manager utility to verify:

- existing healthy services are not duplicated
- stale metadata is detected and replaced
- status normalization returns the expected service states
- launch failures are captured as `failed` with useful details

Add route tests for:

- `POST /api/campaign/launch`
- `GET /api/campaign/status`

These tests should mock process-control internals rather than spawn real long-running services.

### Frontend Tests

Add a lightweight component test for `TargetSetup` that verifies:

- clicking `Launch Campaign` calls the launch route
- polling updates the rendered process statuses
- failure and loading states are visible to the user

### Manual Verification

Manual verification should confirm that:

- the page launches the local chain/container when it is not already running
- the page launches `red_miner`, `blue_miner`, and `validator`
- refreshing the browser preserves and rehydrates visible status
- repeated launches do not create duplicate services

## File-Level Impact

Expected files to modify or add:

- `frontend/components/campaigns/TargetSetup.tsx`
  Expand the UI to launch and display service status.
- `frontend/app/api/campaign/launch/route.ts`
  Add the launch endpoint.
- `frontend/app/api/campaign/status/route.ts`
  Add the status endpoint.
- `frontend/lib/campaign-process-manager.ts` or similar
  Centralize service definitions, state persistence, start logic, and status checks.
- `frontend/.gitignore`
  Ignore runtime metadata/log files if needed.
- frontend test files near the new utility/routes/components
  Cover launch flow and status rendering.

## Open Follow-Up

The `Client API URL` field is intentionally inert in this version. A later iteration can connect it to a local prompt-test endpoint or another model-facing integration without changing the operator-control responsibilities added here.
