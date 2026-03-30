import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import { closeSync, openSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
  CampaignLaunchResult,
  CampaignPreflightResult,
  CampaignProcessManager,
  CampaignRuntimeState,
  CampaignServiceDefinition,
  CampaignServiceSnapshot,
  CampaignServiceState,
} from "./types";
import { DEFAULT_CAMPAIGN_SERVICE_DEFINITIONS } from "./services";

const execFileAsync = promisify(execFile);
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDirectory, "../../..");
const frontendRoot = path.join(repoRoot, "frontend");

export const CAMPAIGN_RUNTIME_DIRECTORY = path.join(frontendRoot, ".runtime");
export const CAMPAIGN_RUNTIME_LOG_DIRECTORY = path.join(
  CAMPAIGN_RUNTIME_DIRECTORY,
  "logs",
);
export const CAMPAIGN_RUNTIME_STATE_FILE = path.join(
  CAMPAIGN_RUNTIME_DIRECTORY,
  "campaign-services.json",
);
const DOCKER_START_TIMEOUT_MS = 60_000;
const DOCKER_START_POLL_INTERVAL_MS = 250;
const DOCKER_START_MAX_POLLS = 8;

interface ResolvedCampaignServiceDefinition extends CampaignServiceDefinition {
  scriptPath: string;
  logPath?: string;
}

interface ContainerInspectionResult {
  healthy: boolean;
  containerId?: string;
  lastKnownError?: string;
}

interface DetachedLaunchResult {
  pid: number;
  launchedAt: string;
  logPath?: string;
  exitCode?: number | null;
  signal?: NodeJS.Signals | null;
  lastKnownError?: string;
  debugLogTail?: string;
}

interface DockerLaunchResult {
  launchedAt: string;
  containerId?: string;
}

interface DockerContainerMetadata {
  exists: boolean;
  running: boolean;
  containerId?: string;
}

export interface CampaignManagerDependencies {
  ensureRuntimeLayout(): Promise<void>;
  readRuntimeState(): Promise<CampaignRuntimeState>;
  writeRuntimeState(state: CampaignRuntimeState): Promise<void>;
  inspectContainer(
    service: ResolvedCampaignServiceDefinition,
  ): Promise<ContainerInspectionResult>;
  isProcessAlive(pid: number): boolean;
  startDetachedService(
    service: ResolvedCampaignServiceDefinition,
  ): Promise<DetachedLaunchResult>;
  startDockerService(
    service: ResolvedCampaignServiceDefinition,
  ): Promise<DockerLaunchResult>;
  runLaunchPreflight?(): Promise<CampaignPreflightResult>;
  now(): string;
}

interface CreateCampaignProcessManagerOptions {
  services?: CampaignServiceDefinition[];
  dependencies?: Partial<CampaignManagerDependencies>;
}

export async function ensureCampaignRuntimeLayout(): Promise<void> {
  await fs.mkdir(CAMPAIGN_RUNTIME_LOG_DIRECTORY, { recursive: true });
}

export async function readCampaignRuntimeState(): Promise<CampaignRuntimeState> {
  try {
    const contents = await fs.readFile(CAMPAIGN_RUNTIME_STATE_FILE, "utf8");
    const parsed = JSON.parse(contents);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return parsed as CampaignRuntimeState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }

    if (error instanceof SyntaxError) {
      return {};
    }

    throw error;
  }
}

export async function writeCampaignRuntimeState(
  state: CampaignRuntimeState,
): Promise<void> {
  await writeCampaignRuntimeStateFile(state, CAMPAIGN_RUNTIME_STATE_FILE);
}

export async function writeCampaignRuntimeStateFile(
  state: CampaignRuntimeState,
  filePath: string,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const temporaryPath = path.join(
    path.dirname(filePath),
    `${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  await fs.writeFile(temporaryPath, JSON.stringify(state, null, 2), "utf8");
  await fs.rename(temporaryPath, filePath);
}

function resolveServiceDefinition(
  definition: CampaignServiceDefinition,
): ResolvedCampaignServiceDefinition {
  return {
    ...definition,
    scriptPath: path.join(repoRoot, definition.scriptRelativePath),
    logPath: definition.logFileName
      ? path.join(CAMPAIGN_RUNTIME_LOG_DIRECTORY, definition.logFileName)
      : undefined,
  };
}

function createBaseServiceState(
  service: ResolvedCampaignServiceDefinition,
): CampaignServiceState {
  return {
    service: service.key,
    label: service.label,
    status: "stopped",
    launcher: service.healthCheck,
    scriptPath: service.scriptPath,
    commandLabel: service.commandLabel,
    ...(service.containerName ? { containerName: service.containerName } : {}),
    ...(service.logPath ? { logPath: service.logPath } : {}),
  };
}

function createDependencies(): CampaignManagerDependencies {
  return {
    ensureRuntimeLayout: ensureCampaignRuntimeLayout,
    readRuntimeState: readCampaignRuntimeState,
    writeRuntimeState: writeCampaignRuntimeState,
    inspectContainer: inspectDockerContainer,
    isProcessAlive: isProcessAlive,
    startDetachedService: startDetachedService,
    startDockerService: startDockerService,
    now: () => new Date().toISOString(),
  };
}

async function inspectDockerContainer(
  service: ResolvedCampaignServiceDefinition,
): Promise<ContainerInspectionResult> {
  if (!service.containerName) {
    return {
      healthy: false,
      lastKnownError: "Missing container name for Docker-backed service.",
    };
  }

  try {
    const { stdout } = await execFileAsync(
      "docker",
      ["inspect", "--format", "{{json .State}}", service.containerName],
      { cwd: repoRoot },
    );
    const state = JSON.parse(stdout.trim()) as {
      Running?: boolean;
      Status?: string;
    };
    const { stdout: idOutput } = await execFileAsync(
      "docker",
      ["inspect", "--format", "{{.Id}}", service.containerName],
      { cwd: repoRoot },
    );

    return {
      healthy: Boolean(state.Running) || state.Status === "running",
      containerId: idOutput.trim() || undefined,
    };
  } catch (error) {
    return {
      healthy: false,
      lastKnownError: normalizeError(error),
    };
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EPERM") {
      return true;
    }

    return false;
  }
}

async function startDetachedService(
  service: ResolvedCampaignServiceDefinition,
): Promise<DetachedLaunchResult> {
  await ensureCampaignRuntimeLayout();

  const logPath =
    service.logPath ??
    path.join(CAMPAIGN_RUNTIME_LOG_DIRECTORY, `${service.key}.log`);
  const logFd = openSync(logPath, "a");

  try {
    const child = spawn(
      "bash",
      [service.scriptPath, ...(service.launchArguments ?? [])],
      {
        cwd: repoRoot,
        detached: true,
        stdio: ["ignore", logFd, logFd],
        env: process.env,
      },
    );

    child.unref();

    if (!child.pid) {
      throw new Error(`Failed to spawn ${service.label}.`);
    }

    const earlyExit = await new Promise<{
      exitCode?: number | null;
      signal?: NodeJS.Signals | null;
      lastKnownError?: string;
    }>((resolve) => {
      let settled = false;

      const finish = (result: {
        exitCode?: number | null;
        signal?: NodeJS.Signals | null;
        lastKnownError?: string;
      }) => {
        if (settled) {
          return;
        }

        settled = true;
        resolve(result);
      };

      const timer = setTimeout(() => {
        child.off("error", handleError);
        child.off("exit", handleExit);
        finish({});
      }, 250);

      const handleError = (error: Error) => {
        clearTimeout(timer);
        finish({
          lastKnownError: `${service.label} failed to start: ${error.message}`,
        });
      };

      const handleExit = (
        exitCode: number | null,
        signal: NodeJS.Signals | null,
      ) => {
        clearTimeout(timer);
        const details =
          exitCode !== null
            ? `code ${exitCode}`
            : signal
              ? `signal ${signal}`
              : "an unknown reason";
        finish({
          exitCode,
          signal,
          lastKnownError:
            exitCode === 0
              ? undefined
              : `${service.label} exited immediately with ${details}.`,
        });
      };

      child.once("error", handleError);
      child.once("exit", handleExit);
    });
    const debugLogTail =
      earlyExit.lastKnownError ||
      (earlyExit.exitCode !== undefined &&
        earlyExit.exitCode !== null &&
        earlyExit.exitCode !== 0)
        ? await readDebugLogTail(logPath)
        : undefined;

    return {
      pid: child.pid,
      launchedAt: new Date().toISOString(),
      logPath,
      debugLogTail,
      ...earlyExit,
    };
  } finally {
    closeSync(logFd);
  }
}

async function inspectDockerContainerMetadata(
  containerName: string,
): Promise<DockerContainerMetadata> {
  try {
    const { stdout } = await execFileAsync(
      "docker",
      [
        "inspect",
        "--format",
        "{{json .State}} {{.Id}}",
        containerName,
      ],
      { cwd: repoRoot },
    );
    const trimmed = stdout.trim();
    const separatorIndex = trimmed.lastIndexOf("} ");

    if (separatorIndex === -1) {
      return {
        exists: false,
        running: false,
      };
    }

    const state = JSON.parse(trimmed.slice(0, separatorIndex + 1)) as {
      Running?: boolean;
      Status?: string;
    };
    const containerId = trimmed.slice(separatorIndex + 2).trim() || undefined;

    return {
      exists: true,
      running: Boolean(state.Running) || state.Status === "running",
      containerId,
    };
  } catch {
    return {
      exists: false,
      running: false,
    };
  }
}

async function startDockerService(
  service: ResolvedCampaignServiceDefinition,
): Promise<DockerLaunchResult> {
  const verifyHealthyContainer = async (): Promise<DockerLaunchResult> => {
    for (let attempt = 0; attempt < DOCKER_START_MAX_POLLS; attempt += 1) {
      const inspection = await inspectDockerContainer(service);

      if (inspection.healthy) {
        return {
          launchedAt: new Date().toISOString(),
          containerId: inspection.containerId,
        };
      }

      if (attempt < DOCKER_START_MAX_POLLS - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, DOCKER_START_POLL_INTERVAL_MS),
        );
      }
    }

    const inspection = await inspectDockerContainer(service);
    throw new Error(
      inspection.lastKnownError ??
        `${service.label} did not become healthy after launch.`,
    );
  };

  if (service.containerName) {
    const container = await inspectDockerContainerMetadata(service.containerName);

    if (container.exists) {
      if (!container.running) {
        await execFileAsync("docker", ["start", service.containerName], {
          cwd: repoRoot,
        });
      }

      return verifyHealthyContainer();
    }
  }

  await execFileAsync("bash", [service.scriptPath], { cwd: repoRoot });
  return verifyHealthyContainer();
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function readDebugLogTail(
  logPath: string | undefined,
  maxLines = 8,
  maxCharacters = 1200,
): Promise<string | undefined> {
  if (!logPath) {
    return undefined;
  }

  try {
    const contents = await fs.readFile(logPath, "utf8");
    const lines = contents
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return undefined;
    }

    const joined = lines.slice(-maxLines).join("\n");

    if (joined.length <= maxCharacters) {
      return joined;
    }

    return joined.slice(joined.length - maxCharacters);
  } catch {
    return undefined;
  }
}

function areServiceStatesEqual(
  left: CampaignServiceState | undefined,
  right: CampaignServiceState,
): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right);
}

function hasStartingTimedOut(
  launchedAt: string | undefined,
  now: string,
): boolean {
  if (!launchedAt) {
    return false;
  }

  const launchedAtMs = Date.parse(launchedAt);
  const nowMs = Date.parse(now);

  if (Number.isNaN(launchedAtMs) || Number.isNaN(nowMs)) {
    return false;
  }

  return nowMs - launchedAtMs >= DOCKER_START_TIMEOUT_MS;
}

async function inspectPersistedServiceState(
  service: ResolvedCampaignServiceDefinition,
  persistedState: CampaignServiceState | undefined,
  dependencies: CampaignManagerDependencies,
): Promise<CampaignServiceState> {
  const normalizedState: CampaignServiceState = {
    ...createBaseServiceState(service),
    ...persistedState,
  };

  if (service.healthCheck === "docker") {
    const inspection = await dependencies.inspectContainer(service);
    const startingTimedOut =
      normalizedState.status === "starting" &&
      hasStartingTimedOut(normalizedState.launchedAt, dependencies.now());

    return {
      ...normalizedState,
      status: inspection.healthy
        ? "running"
        : startingTimedOut || normalizedState.status === "failed"
          ? "failed"
          : normalizedState.status === "starting"
            ? "starting"
            : "stopped",
      containerName: service.containerName,
      containerId: inspection.containerId ?? normalizedState.containerId,
      lastKnownError: inspection.healthy
        ? undefined
        : startingTimedOut
          ? inspection.lastKnownError ??
            `${service.label} did not become healthy after launch.`
          : normalizedState.lastKnownError ?? inspection.lastKnownError,
    };
  }

  if (!normalizedState.pid) {
    const startingTimedOut =
      normalizedState.status === "starting" &&
      hasStartingTimedOut(normalizedState.launchedAt, dependencies.now());

    return {
      ...normalizedState,
      status:
        startingTimedOut
          ? "failed"
          : normalizedState.status === "starting"
            ? "starting"
            : normalizedState.status === "failed"
              ? "failed"
              : "stopped",
      lastKnownError:
        startingTimedOut
          ? normalizedState.lastKnownError ??
            `${service.label} did not report a PID after launch.`
          : normalizedState.status === "failed"
            ? normalizedState.lastKnownError
            : undefined,
    };
  }

  const healthy = dependencies.isProcessAlive(normalizedState.pid);
  const shouldReadDebugLog = !healthy && Boolean(normalizedState.logPath);
  const debugLogTail = shouldReadDebugLog
    ? await readDebugLogTail(normalizedState.logPath, 8, 1200)
    : undefined;

  const VALIDATOR_COMPLETION_SENTINEL = "All epochs complete. Validator exiting.";
  const effectiveLogTail = debugLogTail ?? normalizedState.debugLogTail;
  const isValidatorKey = service.key.startsWith("validator_");
  const hasCompletionSentinel =
    typeof effectiveLogTail === "string" &&
    effectiveLogTail.includes(VALIDATOR_COMPLETION_SENTINEL);

  if (!healthy && isValidatorKey && hasCompletionSentinel) {
    return {
      ...normalizedState,
      status: "stopped",
      lastKnownError: undefined,
      debugLogTail: effectiveLogTail,
    };
  }

  const crashEvidence =
    normalizedState.lastKnownError ??
    debugLogTail ??
    normalizedState.debugLogTail;

  return {
    ...normalizedState,
    status: healthy
      ? normalizedState.status === "starting"
        ? "running"
        : "running"
      : normalizedState.status === "failed" || Boolean(crashEvidence)
        ? "failed"
        : normalizedState.status === "starting"
          ? "failed"
          : "stopped",
    debugLogTail: healthy
      ? undefined
      : debugLogTail ?? normalizedState.debugLogTail,
  };
}

function buildSnapshot(
  states: CampaignServiceState[],
): CampaignServiceSnapshot {
  return states.reduce((snapshot, serviceState) => {
    snapshot[serviceState.service] = serviceState;
    return snapshot;
  }, {} as CampaignServiceSnapshot);
}

function buildSnapshotFromState(
  services: ResolvedCampaignServiceDefinition[],
  state: CampaignRuntimeState,
): CampaignServiceSnapshot {
  return buildSnapshot(
    services.map((service) => ({
      ...createBaseServiceState(service),
      ...state[service.key],
    })),
  );
}

export function createCampaignProcessManager(
  options: CreateCampaignProcessManagerOptions = {},
): CampaignProcessManager {
  const services = (
    options.services ?? DEFAULT_CAMPAIGN_SERVICE_DEFINITIONS
  ).map(
    resolveServiceDefinition,
  );
  const dependencies = {
    ...createDependencies(),
    ...options.dependencies,
  } satisfies CampaignManagerDependencies;
  let launchInFlight: Promise<void> | null = null;

  return {
    async getCampaignServiceSnapshot(): Promise<CampaignServiceSnapshot> {
      await dependencies.ensureRuntimeLayout();
      const state = await dependencies.readRuntimeState();
      const normalizedStates = await Promise.all(
        services.map((service) =>
          inspectPersistedServiceState(service, state[service.key], dependencies),
        ),
      );
      let stateChanged = false;

      for (const normalizedState of normalizedStates) {
        if (!areServiceStatesEqual(state[normalizedState.service], normalizedState)) {
          state[normalizedState.service] = normalizedState;
          stateChanged = true;
        }
      }

      if (stateChanged) {
        await dependencies.writeRuntimeState(state);
      }

      return buildSnapshot(normalizedStates);
    },

    async launchCampaignServices(): Promise<CampaignLaunchResult> {
      await dependencies.ensureRuntimeLayout();
      const state = await dependencies.readRuntimeState();

      if (launchInFlight) {
        return buildSnapshotFromState(services, state);
      }

      if (dependencies.runLaunchPreflight) {
        const preflight = await dependencies.runLaunchPreflight();

        if (!preflight.ready) {
          return {
            launchStarted: false,
            services: buildSnapshotFromState(services, state),
            preflight,
          };
        }
      }

      const launchQueue: ResolvedCampaignServiceDefinition[] = [];

      for (const service of services) {
        const currentState = await inspectPersistedServiceState(
          service,
          state[service.key],
          dependencies,
        );
        state[service.key] = currentState;

        if (currentState.status === "running") {
          continue;
        }
      }

      for (const service of services) {
        if (state[service.key]?.status === "running") {
          continue;
        }

        launchQueue.push(service);
        state[service.key] = {
          ...createBaseServiceState(service),
          status: "starting",
          launchedAt: dependencies.now(),
          ...(state[service.key]?.containerId
            ? { containerId: state[service.key]?.containerId }
            : {}),
        };
      }

      await dependencies.writeRuntimeState(state);

      launchInFlight = new Promise((resolve) => {
        setTimeout(() => {
          void (async () => {
            try {
              for (const service of launchQueue) {
                const latestState = await dependencies.readRuntimeState();

                try {
                  if (service.healthCheck === "docker") {
                    const launchResult =
                      await dependencies.startDockerService(service);
                    latestState[service.key] = {
                      ...createBaseServiceState(service),
                      status: "starting",
                      launchedAt: launchResult.launchedAt ?? dependencies.now(),
                      containerId:
                        launchResult.containerId ??
                        latestState[service.key]?.containerId,
                    };
                  } else {
                    const launchResult =
                      await dependencies.startDetachedService(service);
                    latestState[service.key] = {
                      ...createBaseServiceState(service),
                      status:
                        launchResult.lastKnownError ||
                        (launchResult.exitCode !== undefined &&
                          launchResult.exitCode !== null &&
                          launchResult.exitCode !== 0)
                          ? "failed"
                          : "starting",
                      pid: launchResult.pid,
                      launchedAt: launchResult.launchedAt ?? dependencies.now(),
                      logPath: launchResult.logPath ?? service.logPath,
                      lastKnownError: launchResult.lastKnownError,
                      debugLogTail: launchResult.debugLogTail,
                    };
                  }
                } catch (error) {
                  latestState[service.key] = {
                    ...createBaseServiceState(service),
                    status: "failed",
                    launchedAt: dependencies.now(),
                    lastKnownError: normalizeError(error),
                  };
                }

                await dependencies.writeRuntimeState(latestState);
              }
            } finally {
              launchInFlight = null;
              resolve();
            }
          })();
        }, 0);
      });

      void launchInFlight;

      return buildSnapshotFromState(services, state);
    },
  };
}

export const campaignProcessManager = createCampaignProcessManager();

export type {
  CampaignProcessManager,
  CampaignRuntimeState,
  CampaignServiceDefinition,
};
