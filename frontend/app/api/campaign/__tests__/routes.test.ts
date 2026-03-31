import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "../launch/route.ts";
import { GET } from "../status/route.ts";
import { campaignProcessManager } from "../../../../lib/campaign/process-manager.ts";
import type { CampaignServiceSnapshot } from "../../../../lib/campaign/types.ts";

function createSnapshot(): CampaignServiceSnapshot {
  return {
    local_chain: {
      service: "local_chain",
      label: "Local Chain",
      status: "running",
      launcher: "docker",
      containerName: "local_chain",
      containerId: "container-1",
      launchedAt: "2026-03-30T10:00:00.000Z",
      commandLabel: "docker run local_chain",
      scriptPath:
        "/Users/cavine/Code/Talos/subnet/scripts/localnet/02_start_chain.sh",
    },
    red_miner_1: {
      service: "red_miner_1",
      label: "Red Miner 1",
      status: "running",
      launcher: "process",
      pid: 2001,
      launchedAt: "2026-03-30T10:00:01.000Z",
      commandLabel: "red miner 1",
      scriptPath:
        "/Users/cavine/Code/Talos/subnet/scripts/localnet/07_run_red_miner.sh",
      logPath: "/tmp/red-1.log",
    },
    red_miner_2: {
      service: "red_miner_2",
      label: "Red Miner 2",
      status: "stopped",
      launcher: "process",
      commandLabel: "red miner 2",
      scriptPath:
        "/Users/cavine/Code/Talos/subnet/scripts/localnet/07_run_red_miner.sh",
    },
    red_miner_3: {
      service: "red_miner_3",
      label: "Red Miner 3",
      status: "stopped",
      launcher: "process",
      commandLabel: "red miner 3",
      scriptPath:
        "/Users/cavine/Code/Talos/subnet/scripts/localnet/07_run_red_miner.sh",
    },
    red_miner_4: {
      service: "red_miner_4",
      label: "Red Miner 4",
      status: "stopped",
      launcher: "process",
      commandLabel: "red miner 4",
      scriptPath:
        "/Users/cavine/Code/Talos/subnet/scripts/localnet/07_run_red_miner.sh",
    },
    red_miner_5: {
      service: "red_miner_5",
      label: "Red Miner 5",
      status: "stopped",
      launcher: "process",
      commandLabel: "red miner 5",
      scriptPath:
        "/Users/cavine/Code/Talos/subnet/scripts/localnet/07_run_red_miner.sh",
    },
    blue_miner_1: {
      service: "blue_miner_1",
      label: "Blue Miner 1",
      status: "stopped",
      launcher: "process",
      commandLabel: "blue miner 1",
      scriptPath:
        "/Users/cavine/Code/Talos/subnet/scripts/localnet/08_run_blue_miner.sh",
    },
    blue_miner_2: {
      service: "blue_miner_2",
      label: "Blue Miner 2",
      status: "stopped",
      launcher: "process",
      commandLabel: "blue miner 2",
      scriptPath:
        "/Users/cavine/Code/Talos/subnet/scripts/localnet/08_run_blue_miner.sh",
    },
    blue_miner_3: {
      service: "blue_miner_3",
      label: "Blue Miner 3",
      status: "stopped",
      launcher: "process",
      commandLabel: "blue miner 3",
      scriptPath:
        "/Users/cavine/Code/Talos/subnet/scripts/localnet/08_run_blue_miner.sh",
    },
    blue_miner_4: {
      service: "blue_miner_4",
      label: "Blue Miner 4",
      status: "stopped",
      launcher: "process",
      commandLabel: "blue miner 4",
      scriptPath:
        "/Users/cavine/Code/Talos/subnet/scripts/localnet/08_run_blue_miner.sh",
    },
    blue_miner_5: {
      service: "blue_miner_5",
      label: "Blue Miner 5",
      status: "stopped",
      launcher: "process",
      commandLabel: "blue miner 5",
      scriptPath:
        "/Users/cavine/Code/Talos/subnet/scripts/localnet/08_run_blue_miner.sh",
    },
    validator_1: {
      service: "validator_1",
      label: "Validator 1",
      status: "failed",
      launcher: "process",
      commandLabel: "validator 1",
      scriptPath:
        "/Users/cavine/Code/Talos/subnet/scripts/localnet/09_run_validator.sh",
      lastKnownError: "launch failed",
    },
    validator_2: {
      service: "validator_2",
      label: "Validator 2",
      status: "stopped",
      launcher: "process",
      commandLabel: "validator 2",
      scriptPath:
        "/Users/cavine/Code/Talos/subnet/scripts/localnet/09_run_validator.sh",
    },
    validator_3: {
      service: "validator_3",
      label: "Validator 3",
      status: "stopped",
      launcher: "process",
      commandLabel: "validator 3",
      scriptPath:
        "/Users/cavine/Code/Talos/subnet/scripts/localnet/09_run_validator.sh",
    },
  };
}

const snapshot: CampaignServiceSnapshot = createSnapshot();

const startingSnapshot: CampaignServiceSnapshot = {
  ...snapshot,
  local_chain: {
    ...snapshot.local_chain!,
    status: "starting",
  },
  red_miner_1: {
    ...snapshot.red_miner_1!,
    status: "starting",
  },
};

test("GET /api/campaign/status returns the normalized snapshot from the manager", async () => {
  const originalGet = campaignProcessManager.getCampaignServiceSnapshot;
  campaignProcessManager.getCampaignServiceSnapshot = async () => snapshot;

  try {
    const response = await GET();
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, { services: snapshot });
  } finally {
    campaignProcessManager.getCampaignServiceSnapshot = originalGet;
  }
});

test("GET /api/campaign/status returns a 500 failure payload when the manager throws", async () => {
  const originalGet = campaignProcessManager.getCampaignServiceSnapshot;
  campaignProcessManager.getCampaignServiceSnapshot = async () => {
    throw new Error("status lookup failed");
  };

  try {
    const response = await GET();
    const payload = await response.json();

    assert.equal(response.status, 500);
    assert.deepEqual(payload, {
      services: null,
      error: "status lookup failed",
    });
  } finally {
    campaignProcessManager.getCampaignServiceSnapshot = originalGet;
  }
});

test("POST /api/campaign/launch triggers launch and returns all service states", async () => {
  let launchCalls = 0;
  const originalLaunch = campaignProcessManager.launchCampaignServices;
  campaignProcessManager.launchCampaignServices = async () => {
    launchCalls += 1;
    return snapshot;
  };

  try {
    const response = await POST(
      new Request("http://localhost/api/campaign/launch", { method: "POST" }),
    );
    const payload = await response.json();

    assert.equal(launchCalls, 1);
    assert.equal(response.status, 200);
    assert.deepEqual(payload, { services: snapshot });
  } finally {
    campaignProcessManager.launchCampaignServices = originalLaunch;
  }
});

test("POST /api/campaign/launch can return starting services while startup is still in progress", async () => {
  const originalLaunch = campaignProcessManager.launchCampaignServices;
  campaignProcessManager.launchCampaignServices = async () => startingSnapshot;

  try {
    const response = await POST(
      new Request("http://localhost/api/campaign/launch", { method: "POST" }),
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, { services: startingSnapshot });
  } finally {
    campaignProcessManager.launchCampaignServices = originalLaunch;
  }
});

test("POST /api/campaign/launch returns structured preflight blockers when bootstrap is incomplete", async () => {
  const originalLaunch = campaignProcessManager.launchCampaignServices;
  campaignProcessManager.launchCampaignServices = async () =>
    ({
      services: snapshot,
      launchStarted: false,
      preflight: {
        ready: false,
        checkedAt: "2026-03-30T10:00:00.000Z",
        chainEndpoint: "ws://127.0.0.1:9945",
        netuid: 2,
        readmePath: "/Users/cavine/Code/Talos/subnet/README.md",
        blockers: [
          {
            code: "wallets_unregistered",
            title: "Register the required miners and validators",
            detail:
              "The required hotkeys are not registered on subnet 2, so the campaign launch is blocked.",
            readmeStep: "Step 8",
            commands: ["./scripts/localnet/06_register_neurons.sh"],
            affectedWallets: ["test-validator-1", "test-red-miner-1"],
          },
        ],
      },
    }) as unknown as CampaignServiceSnapshot;

  try {
    const response = await POST(
      new Request("http://localhost/api/campaign/launch", { method: "POST" }),
    );
    const payload = await response.json();

    assert.equal(response.status, 409);
    assert.deepEqual(payload, {
      services: snapshot,
      launchStarted: false,
      preflight: {
        ready: false,
        checkedAt: "2026-03-30T10:00:00.000Z",
        chainEndpoint: "ws://127.0.0.1:9945",
        netuid: 2,
        readmePath: "/Users/cavine/Code/Talos/subnet/README.md",
        blockers: [
          {
            code: "wallets_unregistered",
            title: "Register the required miners and validators",
            detail:
              "The required hotkeys are not registered on subnet 2, so the campaign launch is blocked.",
            readmeStep: "Step 8",
            commands: ["./scripts/localnet/06_register_neurons.sh"],
            affectedWallets: ["test-validator-1", "test-red-miner-1"],
          },
        ],
      },
    });
  } finally {
    campaignProcessManager.launchCampaignServices = originalLaunch;
  }
});

test("POST /api/campaign/launch returns a 500 failure payload when the manager throws", async () => {
  const originalLaunch = campaignProcessManager.launchCampaignServices;
  campaignProcessManager.launchCampaignServices = async () => {
    throw new Error("launch request failed");
  };

  try {
    const response = await POST(
      new Request("http://localhost/api/campaign/launch", { method: "POST" }),
    );
    const payload = await response.json();

    assert.equal(response.status, 500);
    assert.deepEqual(payload, {
      services: null,
      error: "launch request failed",
    });
  } finally {
    campaignProcessManager.launchCampaignServices = originalLaunch;
  }
});
