import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import { closeSync, openSync, writeSync } from "node:fs";
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
const SERVICE_START_TIMEOUT_MS = 60_000;
export const DEFAULT_CAMPAIGN_CHAIN_ENDPOINT =
  process.env.CHAIN_ENDPOINT?.trim() || "wss://test.finney.opentensor.ai:443";
const RUN_ALL_SCRIPT_RELATIVE_PATH = "subnet/scripts/testnet/04_run_all.sh";
const RUN_ALL_STOP_SENTINEL = "All miners and validators stopped.";
const VALIDATOR_COMPLETION_SENTINEL = "All epochs complete. Validator exiting.";
const RUN_ALL_LOG_PATH = path.join(CAMPAIGN_RUNTIME_LOG_DIRECTORY, "run_all.log");

interface ResolvedCampaignServiceDefinition extends CampaignServiceDefinition {
  scriptPath: string;
  logPath?: string;
}

interface ChainEndpointInspectionResult {
  healthy: boolean;
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

export interface CampaignManagerDependencies {
  ensureRuntimeLayout(): Promise<void>;
  readRuntimeState(): Promise<CampaignRuntimeState>;
  writeRuntimeState(state: CampaignRuntimeState): Promise<void>;
  inspectChainEndpoint(endpoint: string): Promise<ChainEndpointInspectionResult>;
  isProcessAlive(pid: number): boolean;
  inspectProcessCommand(pid: number): Promise<string | undefined>;
  startDetachedService(
    service: ResolvedCampaignServiceDefinition,
  ): Promise<DetachedLaunchResult>;
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
    ...(service.logPath ? { logPath: service.logPath } : {}),
  };
}

function createDependencies(): CampaignManagerDependencies {
  return {
    ensureRuntimeLayout: ensureCampaignRuntimeLayout,
    readRuntimeState: readCampaignRuntimeState,
    writeRuntimeState: writeCampaignRuntimeState,
    inspectChainEndpoint,
    isProcessAlive: isProcessAlive,
    inspectProcessCommand,
    startDetachedService: startDetachedService,
    now: () => new Date().toISOString(),
  };
}

function isMinerOrValidatorService(
  service: ResolvedCampaignServiceDefinition,
): boolean {
  return (
    service.key.startsWith("red_miner_") ||
    service.key.startsWith("blue_miner_") ||
    service.key.startsWith("validator_")
  );
}

function createRunAllServiceDefinition(): ResolvedCampaignServiceDefinition {
  return {
    key: "red_miner_1",
    label: "Campaign Services",
    scriptRelativePath: RUN_ALL_SCRIPT_RELATIVE_PATH,
    scriptPath: path.join(repoRoot, RUN_ALL_SCRIPT_RELATIVE_PATH),
    commandLabel: "run all campaign services",
    healthCheck: "process",
    logPath: RUN_ALL_LOG_PATH,
  };
}

async function inspectChainEndpoint(
  endpoint: string,
): Promise<ChainEndpointInspectionResult> {
  try {
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(endpoint);
      const timeout = setTimeout(() => {
        socket.close();
        reject(new Error(`Timed out waiting for ${endpoint} to accept a websocket connection.`));
      }, 3_000);

      socket.addEventListener("open", () => {
        clearTimeout(timeout);
        socket.close();
        resolve();
      });

      socket.addEventListener("error", () => {
        clearTimeout(timeout);
        reject(new Error(`${endpoint} rejected the websocket handshake.`));
      });

      socket.addEventListener("close", (event) => {
        clearTimeout(timeout);
        if (event.wasClean) {
          resolve();
          return;
        }

        reject(
          new Error(
            `${endpoint} closed the websocket handshake before the chain RPC became ready.`,
          ),
        );
      });
    });

    return { healthy: true };
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

async function inspectProcessCommand(
  pid: number,
): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync(
      "ps",
      ["-p", String(pid), "-o", "command="],
      { cwd: repoRoot },
    );
    const command = stdout.trim();
    return command || undefined;
  } catch {
    return undefined;
  }
}

function resolveExpectedProcessMarker(
  normalizedState: CampaignServiceState,
  service: ResolvedCampaignServiceDefinition,
): string {
  if (normalizedState.logPath === RUN_ALL_LOG_PATH) {
    return path.basename(RUN_ALL_SCRIPT_RELATIVE_PATH);
  }

  return path.basename(service.scriptPath);
}

function isSharedRunAllState(
  normalizedState: CampaignServiceState,
): boolean {
  return normalizedState.logPath === RUN_ALL_LOG_PATH;
}

async function startDetachedService(
  service: ResolvedCampaignServiceDefinition,
): Promise<DetachedLaunchResult> {
  await ensureCampaignRuntimeLayout();

  const logPath =
    service.logPath ??
    path.join(CAMPAIGN_RUNTIME_LOG_DIRECTORY, `${service.key}.log`);
  const logFd = openSync(
    logPath,
    service.logPath === RUN_ALL_LOG_PATH ? "w" : "a",
  );

  try {
    if (service.logPath === RUN_ALL_LOG_PATH) {
      writeSync(
        logFd,
        `[frontend-launch ${new Date().toISOString()}] ${service.commandLabel}\n`,
      );
    }

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

  return nowMs - launchedAtMs >= SERVICE_START_TIMEOUT_MS;
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

  const processAlive = dependencies.isProcessAlive(normalizedState.pid);
  const processCommand = processAlive
    ? await dependencies.inspectProcessCommand(normalizedState.pid)
    : undefined;
  const expectedProcessMarker = resolveExpectedProcessMarker(
    normalizedState,
    service,
  );
  const processCommandMismatch =
    processAlive &&
    typeof processCommand === "string" &&
    !processCommand.includes(expectedProcessMarker);
  const healthy =
    processAlive &&
    !processCommandMismatch;
  const shouldReadDebugLog = !healthy && Boolean(normalizedState.logPath);
  const debugLogTail = shouldReadDebugLog
    ? await readDebugLogTail(normalizedState.logPath, 8, 1200)
    : undefined;

  const effectiveLogTail = debugLogTail ?? normalizedState.debugLogTail;
  const isValidatorKey = service.key.startsWith("validator_");
  const isMinerOrValidatorKey = isMinerOrValidatorService(service);
  const hasRunAllStopSentinel =
    typeof effectiveLogTail === "string" &&
    effectiveLogTail.includes(RUN_ALL_STOP_SENTINEL);
  const hasCompletionSentinel =
    typeof effectiveLogTail === "string" &&
    effectiveLogTail.includes(VALIDATOR_COMPLETION_SENTINEL);

  // When run_all.sh is still alive, validators won't be caught by !healthy checks.
  // Read the individual validator log to detect completion independently.
  const shouldCheckIndividualLog =
    healthy &&
    isValidatorKey &&
    isSharedRunAllState(normalizedState) &&
    Boolean(service.logPath);
  const individualLogTail = shouldCheckIndividualLog
    ? await readDebugLogTail(service.logPath, 8, 1200)
    : undefined;
  const hasCompletionSentinelInIndividualLog =
    typeof individualLogTail === "string" &&
    individualLogTail.includes(VALIDATOR_COMPLETION_SENTINEL);

  // When miners become unhealthy in a shared run_all state, check if any
  // validator has completed (set weights). If so, the miner exited normally.
  const isMinerKey =
    service.key.startsWith("red_miner_") ||
    service.key.startsWith("blue_miner_");
  const shouldCheckValidatorLogs =
    !healthy &&
    isMinerKey &&
    isSharedRunAllState(normalizedState);
  let validatorsCompleted = false;
  if (shouldCheckValidatorLogs) {
    const validatorLogNames = [1].map(
      (i) => path.join(CAMPAIGN_RUNTIME_LOG_DIRECTORY, `validator_${i}.log`),
    );
    for (const logFile of validatorLogNames) {
      const tail = await readDebugLogTail(logFile, 8, 1200);
      if (
        typeof tail === "string" &&
        tail.includes(VALIDATOR_COMPLETION_SENTINEL)
      ) {
        validatorsCompleted = true;
        break;
      }
    }
  }

  if (processCommandMismatch && isSharedRunAllState(normalizedState)) {
    return {
      ...createBaseServiceState(service),
      status: "stopped",
    };
  }

  if (healthy && isValidatorKey && hasCompletionSentinelInIndividualLog) {
    return {
      ...normalizedState,
      status: "stopped",
      lastKnownError: undefined,
      debugLogTail: individualLogTail,
    };
  }

  if (!healthy && isMinerOrValidatorKey && hasRunAllStopSentinel) {
    return {
      ...normalizedState,
      status: "stopped",
      lastKnownError: undefined,
      debugLogTail: effectiveLogTail,
    };
  }

  if (!healthy && isValidatorKey && hasCompletionSentinel) {
    return {
      ...normalizedState,
      status: "stopped",
      lastKnownError: undefined,
      debugLogTail: effectiveLogTail,
    };
  }

  if (!healthy && isMinerKey && validatorsCompleted) {
    return {
      ...normalizedState,
      status: "stopped",
      lastKnownError: undefined,
      debugLogTail: VALIDATOR_COMPLETION_SENTINEL,
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
    async stopCampaignServices(): Promise<CampaignServiceSnapshot> {
      await dependencies.ensureRuntimeLayout();
      const state = await dependencies.readRuntimeState();
      const processServices = services;

      const runAllPid = processServices
        .map((s) => state[s.key]?.pid)
        .find((pid) => pid !== undefined && isProcessAlive(pid));

      if (runAllPid !== undefined) {
        try {
          process.kill(runAllPid, "SIGINT");
        } catch {
          // Process may have already exited between the check and the signal.
        }
      }

      const normalizedStates = await Promise.all(
        services.map((service) =>
          inspectPersistedServiceState(service, state[service.key], dependencies),
        ),
      );

      for (const normalizedState of normalizedStates) {
        state[normalizedState.service] = normalizedState;
      }

      await dependencies.writeRuntimeState(state);
      return buildSnapshot(normalizedStates);
    },

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

      const processServices = services;
      const processServicesToLaunch = processServices.filter(
        (service) => state[service.key]?.status !== "running",
      );
      const shouldLaunchProcessGroup = processServicesToLaunch.length > 0;
      const launchedAt = dependencies.now();

      if (shouldLaunchProcessGroup) {
        for (const service of processServices) {
          state[service.key] = {
            ...createBaseServiceState(service),
            status: "starting",
            launchedAt,
            logPath: RUN_ALL_LOG_PATH,
          };
        }
      }

      await dependencies.writeRuntimeState(state);

      launchInFlight = new Promise((resolve) => {
        setTimeout(() => {
          void (async () => {
            try {
              if (shouldLaunchProcessGroup) {
                const latestState = await dependencies.readRuntimeState();
                const runAllService = createRunAllServiceDefinition();

                try {
                  const launchResult =
                    await dependencies.startDetachedService(runAllService);
                  const nextStatus: CampaignServiceState["status"] =
                    launchResult.lastKnownError ||
                    (launchResult.exitCode !== undefined &&
                      launchResult.exitCode !== null &&
                      launchResult.exitCode !== 0)
                      ? "failed"
                      : "starting";

                  for (const processService of processServices) {
                    latestState[processService.key] = {
                      ...createBaseServiceState(processService),
                      status: nextStatus,
                      pid: launchResult.pid,
                      launchedAt: launchResult.launchedAt ?? dependencies.now(),
                      logPath: launchResult.logPath ?? RUN_ALL_LOG_PATH,
                      lastKnownError: launchResult.lastKnownError,
                      debugLogTail: launchResult.debugLogTail,
                    };
                  }
                } catch (error) {
                  for (const processService of processServices) {
                    latestState[processService.key] = {
                      ...createBaseServiceState(processService),
                      status: "failed",
                      launchedAt: dependencies.now(),
                      logPath: RUN_ALL_LOG_PATH,
                      lastKnownError: normalizeError(error),
                    };
                  }
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
