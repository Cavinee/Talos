import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import * as processManagerModule from "../process-manager.ts";
import {
  createCampaignProcessManager,
  CAMPAIGN_RUNTIME_LOG_DIRECTORY,
  type CampaignManagerDependencies,
  type CampaignRuntimeState,
  type CampaignServiceDefinition,
} from "../process-manager.ts";

const RED_MINER_KEYS = [
  "red_miner_1",
  "red_miner_2",
  "red_miner_3",
  "red_miner_4",
  "red_miner_5",
] as const;
const BLUE_MINER_KEYS = [
  "blue_miner_1",
  "blue_miner_2",
  "blue_miner_3",
  "blue_miner_4",
  "blue_miner_5",
] as const;
const VALIDATOR_KEYS = [
  "validator_1",
  "validator_2",
  "validator_3",
] as const;

function createDefaultServices(): CampaignServiceDefinition[] {
  return [
    {
      key: "local_chain",
      label: "Local Chain",
      scriptRelativePath: "subnet/scripts/localnet/02_start_chain.sh",
      commandLabel: "docker run local_chain",
      healthCheck: "docker",
      containerName: "local_chain",
    },
    ...RED_MINER_KEYS.map((key, index) => ({
      key,
      label: `Red Miner ${index + 1}`,
      scriptRelativePath: "subnet/scripts/localnet/07_run_red_miner.sh",
      commandLabel: `red miner ${index + 1}`,
      healthCheck: "process" as const,
      launchArguments: [`${index + 1}`],
    })),
    ...BLUE_MINER_KEYS.map((key, index) => ({
      key,
      label: `Blue Miner ${index + 1}`,
      scriptRelativePath: "subnet/scripts/localnet/08_run_blue_miner.sh",
      commandLabel: `blue miner ${index + 1}`,
      healthCheck: "process" as const,
      launchArguments: [`${index + 1}`],
    })),
    ...VALIDATOR_KEYS.map((key, index) => ({
      key,
      label: `Validator ${index + 1}`,
      scriptRelativePath: "subnet/scripts/localnet/09_run_validator.sh",
      commandLabel: `validator ${index + 1}`,
      healthCheck: "process" as const,
      launchArguments: [`${index + 1}`],
    })),
  ];
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function createStateStore(initial: CampaignRuntimeState = {}) {
  let state = structuredClone(initial);

  return {
    read: async () => structuredClone(state),
    write: async (nextState: CampaignRuntimeState) => {
      state = structuredClone(nextState);
    },
    current: () => structuredClone(state),
  };
}

function createManager(options: {
  state?: CampaignRuntimeState;
  services?: CampaignServiceDefinition[];
  overrides?: Partial<CampaignManagerDependencies>;
}) {
  const store = createStateStore(options.state);
  const dependencies: CampaignManagerDependencies = {
    ensureRuntimeLayout: async () => undefined,
    readRuntimeState: store.read,
    writeRuntimeState: store.write,
    inspectContainer: async () => ({ healthy: false }),
    inspectChainEndpoint: async () => ({ healthy: true }),
    isProcessAlive: () => false,
    startDetachedService: async () => ({
      pid: 999,
      launchedAt: "2026-03-30T10:00:00.000Z",
      logPath: "/tmp/default.log",
    }),
    startDockerService: async () => ({
      containerId: "container-123",
      launchedAt: "2026-03-30T10:00:00.000Z",
    }),
    now: () => "2026-03-30T10:00:00.000Z",
    ...options.overrides,
  };

  const services =
    options.services ??
    createDefaultServices();

  return {
    manager: createCampaignProcessManager({ services, dependencies }),
    store,
    dependencies,
  };
}

function createBlockedPreflight() {
  return {
    ready: false,
    checkedAt: "2026-03-30T10:00:00.000Z",
    chainEndpoint: "ws://127.0.0.1:9945",
    netuid: 2,
    readmePath: "/Users/cavine/Code/Talos/subnet/README.md",
    blockers: [
      {
        code: "subnet_missing",
        title: "Create subnet 2 on the local chain",
        detail:
          "The local chain is reachable, but subnet 2 has not been created yet.",
        readmeStep: "Step 5",
        commands: ["./scripts/localnet/05_create_subnet.sh"],
      },
      {
        code: "wallets_unregistered",
        title: "Register the required miners and validators",
        detail:
          "The required hotkeys are not registered on subnet 2, so the campaign cannot launch safely.",
        readmeStep: "Step 8",
        commands: ["./scripts/localnet/06_register_neurons.sh"],
        affectedWallets: ["test-validator-1", "test-red-miner-1"],
      },
    ],
  };
}

test("a healthy already-running service is not relaunched", async () => {
  let startCalls = 0;
  const { manager, store } = createManager({
    services: [
      {
        key: "red_miner_1",
        label: "Red Miner 1",
        scriptRelativePath: "subnet/scripts/localnet/07_run_red_miner.sh",
        commandLabel: "red miner 1",
        healthCheck: "process",
        launchArguments: ["1"],
      },
    ],
    state: {
      red_miner_1: {
        service: "red_miner_1",
        label: "Red Miner 1",
        status: "running",
        launcher: "process",
        pid: 4242,
        scriptPath:
          "/Users/cavine/Code/Talos/subnet/scripts/localnet/07_run_red_miner.sh",
        launchedAt: "2026-03-30T09:00:00.000Z",
        commandLabel: "red miner 1",
        logPath: "/tmp/red.log",
      },
    },
    overrides: {
      isProcessAlive: (pid) => pid === 4242,
      startDetachedService: async () => {
        startCalls += 1;
        return {
          pid: 9999,
          launchedAt: "2026-03-30T10:00:00.000Z",
          logPath: "/tmp/unused.log",
        };
      },
    },
  });

  const snapshot = await manager.launchCampaignServices();

  assert.equal(startCalls, 0);
  assert.equal(snapshot.red_miner_1.status, "running");
  assert.equal(snapshot.red_miner_1.pid, 4242);
  assert.equal(store.current().red_miner_1?.status, "running");
});

test("concurrent runtime state writes do not collide on a shared temporary filename", async () => {
  const { writeCampaignRuntimeStateFile } = processManagerModule as {
    writeCampaignRuntimeStateFile?: (
      state: CampaignRuntimeState,
      filePath: string,
    ) => Promise<void>;
  };
  const runtimeDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "campaign-runtime-"),
  );
  const stateFilePath = path.join(runtimeDirectory, "campaign-services.json");

  try {
    await Promise.all([
      writeCampaignRuntimeStateFile!(
        {
          red_miner_1: {
            service: "red_miner_1",
            label: "Red Miner 1",
            status: "failed",
            launcher: "process",
            scriptPath: "/tmp/red.sh",
            commandLabel: "red miner 1",
            logPath: "/tmp/red.log",
          },
        },
        stateFilePath,
      ),
      writeCampaignRuntimeStateFile!(
        {
          blue_miner_1: {
            service: "blue_miner_1",
            label: "Blue Miner 1",
            status: "failed",
            launcher: "process",
            scriptPath: "/tmp/blue.sh",
            commandLabel: "blue miner 1",
            logPath: "/tmp/blue.log",
          },
        },
        stateFilePath,
      ),
    ]);

    const persistedState = JSON.parse(
      await fs.readFile(stateFilePath, "utf8"),
    ) as CampaignRuntimeState;

    assert.ok(
      "red_miner_1" in persistedState || "blue_miner_1" in persistedState,
    );
  } finally {
    await fs.rm(runtimeDirectory, { recursive: true, force: true });
  }
});

test("stale pid metadata is replaced", async () => {
  let started = 0;
  const { manager, store } = createManager({
    services: [
      {
        key: "blue_miner_1",
        label: "Blue Miner 1",
        scriptRelativePath: "subnet/scripts/localnet/08_run_blue_miner.sh",
        commandLabel: "blue miner 1",
        healthCheck: "process",
        launchArguments: ["1"],
      },
    ],
    state: {
      blue_miner_1: {
        service: "blue_miner_1",
        label: "Blue Miner 1",
        status: "running",
        launcher: "process",
        pid: 2121,
        scriptPath:
          "/Users/cavine/Code/Talos/subnet/scripts/localnet/08_run_blue_miner.sh",
        launchedAt: "2026-03-30T09:00:00.000Z",
        commandLabel: "blue miner 1",
        logPath: "/tmp/old-blue.log",
        lastKnownError: "old error",
      },
    },
    overrides: {
      isProcessAlive: (pid) => pid === 3131,
      startDetachedService: async () => {
        started += 1;
        return {
          pid: 3131,
          launchedAt: "2026-03-30T10:05:00.000Z",
          logPath: "/tmp/new-blue.log",
        };
      },
    },
  });

  const launchSnapshot = await manager.launchCampaignServices();

  assert.equal(launchSnapshot.blue_miner_1.status, "starting");

  await new Promise((resolve) => setTimeout(resolve, 0));

  const snapshot = await manager.getCampaignServiceSnapshot();
  const persisted = store.current().blue_miner_1;

  assert.equal(started, 1);
  assert.equal(snapshot.blue_miner_1.pid, 3131);
  assert.equal(snapshot.blue_miner_1.status, "running");
  assert.equal(snapshot.blue_miner_1.logPath, "/tmp/new-blue.log");
  assert.equal(snapshot.blue_miner_1.lastKnownError, undefined);
  assert.equal(persisted?.pid, 3131);
});

test("failed launches are surfaced as failed", async () => {
  const { manager, store } = createManager({
    services: [
      {
        key: "validator_1",
        label: "Validator 1",
        scriptRelativePath: "subnet/scripts/localnet/09_run_validator.sh",
        commandLabel: "validator 1",
        healthCheck: "process",
        launchArguments: ["1"],
      },
    ],
    overrides: {
      startDetachedService: async () => {
        throw new Error("validator launch exploded");
      },
    },
  });

  const launchSnapshot = await manager.launchCampaignServices();

  assert.equal(launchSnapshot.validator_1.status, "starting");

  await new Promise((resolve) => setTimeout(resolve, 0));

  const snapshot = await manager.getCampaignServiceSnapshot();
  const persisted = store.current().validator_1;

  assert.equal(snapshot.validator_1.status, "failed");
  assert.match(
    snapshot.validator_1.lastKnownError ?? "",
    /validator launch exploded/,
  );
  assert.equal(persisted?.status, "failed");
});

test("launch preflight blocks startup before any campaign services are spawned", async () => {
  let dockerStarts = 0;
  let processStarts = 0;
  const { manager, store } = createManager({
    services: [
      {
        key: "local_chain",
        label: "Local Chain",
        scriptRelativePath: "subnet/scripts/localnet/02_start_chain.sh",
        commandLabel: "docker run local_chain",
        healthCheck: "docker",
        containerName: "local_chain",
      },
      {
        key: "red_miner_1",
        label: "Red Miner 1",
        scriptRelativePath: "subnet/scripts/localnet/07_run_red_miner.sh",
        commandLabel: "red miner 1",
        healthCheck: "process",
        launchArguments: ["1"],
      },
      {
        key: "validator_1",
        label: "Validator 1",
        scriptRelativePath: "subnet/scripts/localnet/09_run_validator.sh",
        commandLabel: "validator 1",
        healthCheck: "process",
        launchArguments: ["1"],
      },
    ],
    overrides: {
      startDockerService: async () => {
        dockerStarts += 1;
        return {
          containerId: "container-123",
          launchedAt: "2026-03-30T10:00:00.000Z",
        };
      },
      startDetachedService: async () => {
        processStarts += 1;
        return {
          pid: 999,
          launchedAt: "2026-03-30T10:00:00.000Z",
          logPath: "/tmp/default.log",
        };
      },
      runLaunchPreflight: async () => createBlockedPreflight(),
    } as Partial<CampaignManagerDependencies>,
  });

  const launchResult = (await manager.launchCampaignServices()) as unknown as {
    launchStarted: boolean;
    services: CampaignRuntimeState;
    preflight: {
      ready: boolean;
      blockers: Array<{ code: string; affectedWallets?: string[] }>;
    };
  };

  assert.equal(launchResult.launchStarted, false);
  assert.equal(launchResult.preflight.ready, false);
  assert.deepEqual(
    launchResult.preflight.blockers.map((blocker) => blocker.code),
    ["subnet_missing", "wallets_unregistered"],
  );
  assert.deepEqual(
    launchResult.preflight.blockers[1]?.affectedWallets,
    ["test-validator-1", "test-red-miner-1"],
  );
  assert.equal(launchResult.services.local_chain?.status, "stopped");
  assert.equal(launchResult.services.red_miner_1?.status, "stopped");
  assert.equal(launchResult.services.validator_1?.status, "stopped");
  assert.equal(dockerStarts, 0);
  assert.equal(processStarts, 0);
  assert.equal(store.current().local_chain?.status, undefined);
  assert.equal(store.current().red_miner_1?.status, undefined);
  assert.equal(store.current().validator_1?.status, undefined);
});

test("a launched process that exits immediately is surfaced as failed", async () => {
  const { manager, store } = createManager({
    services: [
      {
        key: "validator_1",
        label: "Validator 1",
        scriptRelativePath: "subnet/scripts/localnet/09_run_validator.sh",
        commandLabel: "validator 1",
        healthCheck: "process",
        launchArguments: ["1"],
      },
    ],
    overrides: {
      startDetachedService: async () => ({
        pid: 5151,
        launchedAt: "2026-03-30T10:00:00.000Z",
        logPath: "/tmp/validator.log",
        exitCode: 1,
        lastKnownError: "Validator exited immediately with code 1.",
      }),
      isProcessAlive: () => false,
    },
  });

  const launchSnapshot = await manager.launchCampaignServices();

  assert.equal(launchSnapshot.validator_1.status, "starting");

  await new Promise((resolve) => setTimeout(resolve, 0));

  const snapshot = await manager.getCampaignServiceSnapshot();
  const persisted = store.current().validator_1;

  assert.equal(snapshot.validator_1.status, "failed");
  assert.match(
    snapshot.validator_1.lastKnownError ?? "",
    /exited immediately with code 1/i,
  );
  assert.equal(persisted?.status, "failed");
  assert.equal(persisted?.pid, 5151);
});

test("a failed launch preserves a debug log tail for the UI", async () => {
  const { manager, store } = createManager({
    services: [
      {
        key: "validator_1",
        label: "Validator 1",
        scriptRelativePath: "subnet/scripts/localnet/09_run_validator.sh",
        commandLabel: "validator 1",
        healthCheck: "process",
        launchArguments: ["1"],
      },
    ],
    overrides: {
      startDetachedService: async () => ({
        pid: 5151,
        launchedAt: "2026-03-30T10:00:00.000Z",
        logPath: "/tmp/validator.log",
        exitCode: 1,
        lastKnownError: "Validator exited immediately with code 1.",
        debugLogTail:
          "line 18: /tmp/missing-python: No such file or directory",
      }),
      isProcessAlive: () => false,
    } as Partial<CampaignManagerDependencies>,
  });

  await manager.launchCampaignServices();
  await new Promise((resolve) => setTimeout(resolve, 0));

  const snapshot = await manager.getCampaignServiceSnapshot();
  const persisted = store.current().validator_1;

  assert.match(
    snapshot.validator_1.debugLogTail ?? "",
    /missing-python: No such file or directory/i,
  );
  assert.match(
    persisted?.debugLogTail ?? "",
    /missing-python: No such file or directory/i,
  );
});

test("launch returns a starting snapshot before docker startup finishes", async () => {
  const dockerLaunch = createDeferred<{
    containerId?: string;
    launchedAt: string;
  }>();
  let containerHealthy = false;
  const { manager, store } = createManager({
    services: [
      {
        key: "local_chain",
        label: "Local Chain",
        scriptRelativePath: "subnet/scripts/localnet/02_start_chain.sh",
        commandLabel: "docker run local_chain",
        healthCheck: "docker",
        containerName: "local_chain",
      },
    ],
    overrides: {
      startDockerService: async () => dockerLaunch.promise,
      inspectContainer: async () => ({
        healthy: containerHealthy,
        containerId: "container-123",
      }),
    },
  });

  const launchSnapshot = await Promise.race([
    manager.launchCampaignServices(),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("launch timed out")), 50);
    }),
  ]);

  assert.equal(launchSnapshot.local_chain.status, "starting");
  assert.equal(store.current().local_chain?.status, "starting");

  containerHealthy = true;
  dockerLaunch.resolve({
    containerId: "container-123",
    launchedAt: "2026-03-30T10:00:00.000Z",
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  const settledSnapshot = await manager.getCampaignServiceSnapshot();
  assert.equal(settledSnapshot.local_chain.status, "running");
  assert.equal(settledSnapshot.local_chain.containerId, "container-123");
});

test("status polling preserves starting services until docker becomes healthy", async () => {
  const { manager, store } = createManager({
    services: [
      {
        key: "local_chain",
        label: "Local Chain",
        scriptRelativePath: "subnet/scripts/localnet/02_start_chain.sh",
        commandLabel: "docker run local_chain",
        healthCheck: "docker",
        containerName: "local_chain",
      },
    ],
    state: {
      local_chain: {
        service: "local_chain",
        label: "Local Chain",
        status: "starting",
        launcher: "docker",
        containerName: "local_chain",
        scriptPath:
          "/Users/cavine/Code/Talos/subnet/scripts/localnet/02_start_chain.sh",
        launchedAt: "2026-03-30T10:00:00.000Z",
        commandLabel: "docker run local_chain",
      },
    },
    overrides: {
      inspectContainer: async () => ({
        healthy: false,
      }),
    },
  });

  const snapshot = await manager.getCampaignServiceSnapshot();

  assert.equal(snapshot.local_chain.status, "starting");
  assert.equal(store.current().local_chain?.status, "starting");
});

test("docker-backed local chain is marked failed when the container is up but the rpc endpoint is unhealthy", async () => {
  const { manager, store } = createManager({
    services: [
      {
        key: "local_chain",
        label: "Local Chain",
        scriptRelativePath: "subnet/scripts/localnet/02_start_chain.sh",
        commandLabel: "docker run local_chain",
        healthCheck: "docker",
        containerName: "local_chain",
      },
    ],
    state: {
      local_chain: {
        service: "local_chain",
        label: "Local Chain",
        status: "running",
        launcher: "docker",
        containerName: "local_chain",
        containerId: "container-123",
        scriptPath:
          "/Users/cavine/Code/Talos/subnet/scripts/localnet/02_start_chain.sh",
        launchedAt: "2026-03-30T10:00:00.000Z",
        commandLabel: "docker run local_chain",
      },
    },
    overrides: {
      inspectContainer: async () => ({
        healthy: true,
        containerId: "container-123",
      }),
      inspectChainEndpoint: async () => ({
        healthy: false,
        lastKnownError: "ws://127.0.0.1:9945 closed the websocket handshake",
      }),
    } as Partial<CampaignManagerDependencies>,
  });

  const snapshot = await manager.getCampaignServiceSnapshot();

  assert.equal(snapshot.local_chain.status, "failed");
  assert.match(
    snapshot.local_chain.lastKnownError ?? "",
    /closed the websocket handshake/i,
  );
  assert.equal(store.current().local_chain?.status, "failed");
});

test("launch stops before miners and validators when the local chain rpc endpoint is unhealthy", async () => {
  let detachedLaunchCalls = 0;
  const { manager, store } = createManager({
    services: createDefaultServices(),
    overrides: {
      startDockerService: async () => ({
        containerId: "container-123",
        launchedAt: "2026-03-30T10:00:00.000Z",
      }),
      inspectContainer: async () => ({
        healthy: true,
        containerId: "container-123",
      }),
      inspectChainEndpoint: async () => ({
        healthy: false,
        lastKnownError: "ws://127.0.0.1:9945 returned an invalid response",
      }),
      startDetachedService: async () => {
        detachedLaunchCalls += 1;
        return {
          pid: 9999,
          launchedAt: "2026-03-30T10:00:00.000Z",
          logPath: "/tmp/unused.log",
        };
      },
    } as Partial<CampaignManagerDependencies>,
  });

  await manager.launchCampaignServices();
  await new Promise((resolve) => setTimeout(resolve, 0));

  const snapshot = await manager.getCampaignServiceSnapshot();

  assert.equal(detachedLaunchCalls, 0);
  assert.equal(snapshot.local_chain.status, "failed");
  assert.equal(snapshot.red_miner_1.status, "stopped");
  assert.equal(snapshot.blue_miner_1.status, "stopped");
  assert.equal(snapshot.validator_1.status, "stopped");
  assert.equal(store.current().red_miner_1?.status, "stopped");
});

test("status polling marks process startup without a pid as failed after the starting timeout elapses", async () => {
  let currentTime = "2026-03-30T10:00:20.000Z";
  const { manager, store } = createManager({
    services: [
      {
        key: "blue_miner_1",
        label: "Blue Miner 1",
        scriptRelativePath: "subnet/scripts/localnet/08_run_blue_miner.sh",
        commandLabel: "blue miner 1",
        healthCheck: "process",
        launchArguments: ["1"],
      },
    ],
    state: {
      blue_miner_1: {
        service: "blue_miner_1",
        label: "Blue Miner 1",
        status: "starting",
        launcher: "process",
        scriptPath:
          "/Users/cavine/Code/Talos/subnet/scripts/localnet/08_run_blue_miner.sh",
        launchedAt: "2026-03-30T10:00:00.000Z",
        commandLabel: "blue miner 1",
        logPath: "/tmp/blue-1.log",
      },
    },
    overrides: {
      now: () => currentTime,
    },
  });

  const firstSnapshot = await manager.getCampaignServiceSnapshot();
  assert.equal(firstSnapshot.blue_miner_1.status, "starting");

  currentTime = "2026-03-30T10:01:05.000Z";

  const timedOutSnapshot = await manager.getCampaignServiceSnapshot();

  assert.equal(timedOutSnapshot.blue_miner_1.status, "failed");
  assert.match(
    timedOutSnapshot.blue_miner_1.lastKnownError ?? "",
    /did not report a pid after launch/i,
  );
  assert.equal(store.current().blue_miner_1?.status, "failed");
});

test("status polling marks docker startup as failed after the starting timeout elapses", async () => {
  let currentTime = "2026-03-30T10:00:20.000Z";
  const { manager, store } = createManager({
    services: [
      {
        key: "local_chain",
        label: "Local Chain",
        scriptRelativePath: "subnet/scripts/localnet/02_start_chain.sh",
        commandLabel: "docker run local_chain",
        healthCheck: "docker",
        containerName: "local_chain",
      },
    ],
    state: {
      local_chain: {
        service: "local_chain",
        label: "Local Chain",
        status: "starting",
        launcher: "docker",
        containerName: "local_chain",
        scriptPath:
          "/Users/cavine/Code/Talos/subnet/scripts/localnet/02_start_chain.sh",
        launchedAt: "2026-03-30T10:00:00.000Z",
        commandLabel: "docker run local_chain",
      },
    },
    overrides: {
      inspectContainer: async () => ({
        healthy: false,
        lastKnownError: "container exited immediately",
      }),
      now: () => currentTime,
    },
  });

  const firstSnapshot = await manager.getCampaignServiceSnapshot();
  assert.equal(firstSnapshot.local_chain.status, "starting");

  currentTime = "2026-03-30T10:01:05.000Z";

  const timedOutSnapshot = await manager.getCampaignServiceSnapshot();

  assert.equal(timedOutSnapshot.local_chain.status, "failed");
  assert.match(
    timedOutSnapshot.local_chain.lastKnownError ?? "",
    /container exited immediately|did not become healthy/i,
  );
  assert.equal(store.current().local_chain?.status, "failed");
});

test("launch does not start the same service twice while startup is already in progress", async () => {
  const dockerLaunch = createDeferred<{
    containerId?: string;
    launchedAt: string;
  }>();
  let launchCalls = 0;
  const { manager } = createManager({
    services: [
      {
        key: "local_chain",
        label: "Local Chain",
        scriptRelativePath: "subnet/scripts/localnet/02_start_chain.sh",
        commandLabel: "docker run local_chain",
        healthCheck: "docker",
        containerName: "local_chain",
      },
    ],
    overrides: {
      startDockerService: async () => {
        launchCalls += 1;
        return dockerLaunch.promise;
      },
      inspectContainer: async () => ({
        healthy: false,
      }),
    },
  });

  const firstSnapshot = await manager.launchCampaignServices();
  const secondSnapshot = await manager.launchCampaignServices();

  assert.equal(firstSnapshot.local_chain.status, "starting");
  assert.equal(secondSnapshot.local_chain.status, "starting");

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(launchCalls, 1);

  dockerLaunch.resolve({
    containerId: "container-123",
    launchedAt: "2026-03-30T10:00:00.000Z",
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
});

test("status normalization includes the 14 localnet services", async () => {
  const { manager } = createManager({ state: {} });

  const snapshot = await manager.getCampaignServiceSnapshot();

  assert.deepEqual(Object.keys(snapshot).sort(), [
    "blue_miner_1",
    "blue_miner_2",
    "blue_miner_3",
    "blue_miner_4",
    "blue_miner_5",
    "local_chain",
    "red_miner_1",
    "red_miner_2",
    "red_miner_3",
    "red_miner_4",
    "red_miner_5",
    "validator_1",
    "validator_2",
    "validator_3",
  ]);
  assert.equal(snapshot.local_chain.status, "stopped");
  assert.equal(snapshot.red_miner_1.status, "stopped");
  assert.equal(snapshot.red_miner_5.status, "stopped");
  assert.equal(snapshot.blue_miner_1.status, "stopped");
  assert.equal(snapshot.blue_miner_5.status, "stopped");
  assert.equal(snapshot.validator_1.status, "stopped");
  assert.equal(snapshot.validator_3.status, "stopped");
});

test("healthy normalization persists corrected runtime state", async () => {
  const { manager, store } = createManager({
    services: [
      {
        key: "local_chain",
        label: "Local Chain",
        scriptRelativePath: "subnet/scripts/localnet/02_start_chain.sh",
        commandLabel: "docker run local_chain",
        healthCheck: "docker",
        containerName: "local_chain",
      },
    ],
    state: {
      local_chain: {
        service: "local_chain",
        label: "Local Chain",
        status: "stopped",
        launcher: "docker",
        containerName: "local_chain",
        containerId: "old-container",
        scriptPath:
          "/Users/cavine/Code/Talos/subnet/scripts/localnet/02_start_chain.sh",
        launchedAt: "2026-03-30T09:00:00.000Z",
        commandLabel: "docker run local_chain",
        lastKnownError: "stale error",
      },
    },
    overrides: {
      inspectContainer: async () => ({
        healthy: true,
        containerId: "new-container",
      }),
    },
  });

  const snapshot = await manager.getCampaignServiceSnapshot();
  const persisted = store.current().local_chain;

  assert.equal(snapshot.local_chain.status, "running");
  assert.equal(snapshot.local_chain.containerId, "new-container");
  assert.equal(snapshot.local_chain.lastKnownError, undefined);
  assert.equal(persisted?.status, "running");
  assert.equal(persisted?.containerId, "new-container");
  assert.equal(persisted?.lastKnownError, undefined);
});

test("a validator that exited after completing all epochs is shown as stopped, not failed", async () => {
  const { manager, store } = createManager({
    services: [
      {
        key: "validator_1",
        label: "Validator 1",
        scriptRelativePath: "subnet/scripts/localnet/09_run_validator.sh",
        commandLabel: "validator 1",
        healthCheck: "process",
        launchArguments: ["1"],
      },
    ],
    state: {
      validator_1: {
        service: "validator_1",
        label: "Validator 1",
        status: "running",
        launcher: "process",
        pid: 6060,
        scriptPath:
          "/Users/cavine/Code/Talos/subnet/scripts/localnet/09_run_validator.sh",
        launchedAt: "2026-03-30T10:00:00.000Z",
        commandLabel: "validator 1",
        logPath: "/tmp/validator-1.log",
        debugLogTail:
          "Weights set successfully for all miners.\nAll epochs complete. Validator exiting.",
      },
    },
    overrides: {
      isProcessAlive: () => false,
    },
  });

  const snapshot = await manager.getCampaignServiceSnapshot();
  const persisted = store.current().validator_1;

  assert.equal(snapshot.validator_1.status, "stopped");
  assert.equal(snapshot.validator_1.lastKnownError, undefined);
  assert.match(
    snapshot.validator_1.debugLogTail ?? "",
    /All epochs complete/i,
  );
  assert.equal(persisted?.status, "stopped");
  assert.equal(persisted?.lastKnownError, undefined);
});

test("a non-validator service with completion text in its logs still shows as failed", async () => {
  const { manager } = createManager({
    services: [
      {
        key: "red_miner_1",
        label: "Red Miner 1",
        scriptRelativePath: "subnet/scripts/localnet/07_run_red_miner.sh",
        commandLabel: "red miner 1",
        healthCheck: "process",
        launchArguments: ["1"],
      },
    ],
    state: {
      red_miner_1: {
        service: "red_miner_1",
        label: "Red Miner 1",
        status: "running",
        launcher: "process",
        pid: 7070,
        scriptPath:
          "/Users/cavine/Code/Talos/subnet/scripts/localnet/07_run_red_miner.sh",
        launchedAt: "2026-03-30T10:00:00.000Z",
        commandLabel: "red miner 1",
        logPath: "/tmp/red-1.log",
        debugLogTail:
          "All epochs complete. Validator exiting.",
      },
    },
    overrides: {
      isProcessAlive: () => false,
    },
  });

  const snapshot = await manager.getCampaignServiceSnapshot();

  assert.equal(snapshot.red_miner_1.status, "failed");
});

test("dead process entries with preserved crash logs stay failed instead of reverting to stopped", async () => {
  const { manager, store } = createManager({
    services: [
      {
        key: "red_miner_1",
        label: "Red Miner 1",
        scriptRelativePath: "subnet/scripts/localnet/07_run_red_miner.sh",
        commandLabel: "red miner 1",
        healthCheck: "process",
        launchArguments: ["1"],
      },
    ],
    state: {
      red_miner_1: {
        service: "red_miner_1",
        label: "Red Miner 1",
        status: "stopped",
        launcher: "process",
        pid: 4242,
        scriptPath:
          "/Users/cavine/Code/Talos/subnet/scripts/localnet/07_run_red_miner.sh",
        launchedAt: "2026-03-30T10:00:00.000Z",
        commandLabel: "red miner 1",
        logPath: "/tmp/red-1.log",
        debugLogTail: "wallet is not registered to chain connection",
      },
    },
    overrides: {
      isProcessAlive: () => false,
    },
  });

  const snapshot = await manager.getCampaignServiceSnapshot();
  const persisted = store.current().red_miner_1;

  assert.equal(snapshot.red_miner_1.status, "failed");
  assert.match(
    snapshot.red_miner_1.debugLogTail ?? "",
    /wallet is not registered/i,
  );
  assert.equal(persisted?.status, "failed");
});

test("a validator using run_all state is shown as stopped when its individual log contains the completion sentinel", async () => {
  const logFileName = "validator_test_completion_sentinel.log";
  const logPath = path.join(CAMPAIGN_RUNTIME_LOG_DIRECTORY, logFileName);
  const runAllLogPath = path.join(CAMPAIGN_RUNTIME_LOG_DIRECTORY, "run_all.log");

  await fs.mkdir(CAMPAIGN_RUNTIME_LOG_DIRECTORY, { recursive: true });
  await fs.writeFile(
    logPath,
    "Weights set successfully for all miners.\nAll epochs complete. Validator exiting.",
    "utf8",
  );

  try {
    const { manager, store } = createManager({
      services: [
        {
          key: "validator_1",
          label: "Validator 1",
          scriptRelativePath: "subnet/scripts/localnet/09_run_validator.sh",
          commandLabel: "validator 1",
          healthCheck: "process",
          launchArguments: ["1"],
          logFileName,
        },
      ],
      state: {
        validator_1: {
          service: "validator_1",
          label: "Validator 1",
          status: "running",
          launcher: "process",
          pid: 46671,
          scriptPath:
            "/Users/cavine/Code/Talos/subnet/scripts/localnet/09_run_validator.sh",
          launchedAt: "2026-03-30T10:00:00.000Z",
          commandLabel: "validator 1",
          logPath: runAllLogPath,
        },
      },
      overrides: {
        isProcessAlive: (pid) => pid === 46671,
        inspectProcessCommand: async (pid) =>
          pid === 46671
            ? "bash /repo/subnet/scripts/localnet/10_run_all.sh"
            : undefined,
      },
    });

    const snapshot = await manager.getCampaignServiceSnapshot();
    const persisted = store.current().validator_1;

    assert.equal(snapshot.validator_1.status, "stopped");
    assert.equal(snapshot.validator_1.lastKnownError, undefined);
    assert.match(snapshot.validator_1.debugLogTail ?? "", /All epochs complete/i);
    assert.equal(persisted?.status, "stopped");
    assert.equal(persisted?.lastKnownError, undefined);
  } finally {
    await fs.rm(logPath, { force: true });
  }
});
