import assert from "node:assert/strict";
import test from "node:test";

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { JSDOM } from "jsdom";

import TargetSetup from "../TargetSetup";

const RED_MINER_KEYS = ["red_miner_1"] as const;
const BLUE_MINER_KEYS = ["blue_miner_1"] as const;
const VALIDATOR_KEYS = ["validator_1"] as const;

interface MockServiceState {
  service:
    | (typeof RED_MINER_KEYS)[number]
    | (typeof BLUE_MINER_KEYS)[number]
    | (typeof VALIDATOR_KEYS)[number];
  label: string;
  status: "stopped" | "starting" | "running" | "failed";
  launcher: "process";
  scriptPath: string;
  commandLabel: string;
  launchedAt?: string;
  pid?: number;
  logPath?: string;
  lastKnownError?: string;
  debugLogTail?: string;
}

interface MockSnapshot {
  [service: string]: MockServiceState;
}

interface MockResponsePayload {
  services: MockSnapshot | null;
  error?: string;
  launchStarted?: boolean;
  preflight?: {
    ready: boolean;
    checkedAt: string;
    chainEndpoint: string;
    netuid: number;
    readmePath: string;
    blockers: Array<{
      code: string;
      title: string;
      detail: string;
      readmeStep: string;
      commands: string[];
      affectedWallets?: string[];
    }>;
  };
}

interface DeferredStep {
  type: "deferred";
  response: MockResponsePayload;
}

interface ErrorStep {
  type: "error";
  message: string;
}

type FetchStep = MockResponsePayload | DeferredStep | ErrorStep;

interface FetchCall {
  url: string;
  method: string;
}

function createSnapshot(
  statusByKey: Partial<Record<MockServiceState["service"], MockServiceState["status"]>> = {},
  overrides: Partial<Record<MockServiceState["service"], Partial<MockServiceState>>> = {},
): MockSnapshot {
  const baseSnapshot: MockSnapshot = {};

  for (const [keys, baseLabel, basePath, commandLabel] of [
    [RED_MINER_KEYS, "Red Miner", "/tmp/red.sh", "red miner"],
    [BLUE_MINER_KEYS, "Blue Miner", "/tmp/blue.sh", "blue miner"],
    [VALIDATOR_KEYS, "Validator", "/tmp/validator.sh", "validator"],
  ] as const) {
    for (const [index, key] of keys.entries()) {
      baseSnapshot[key] = {
        service: key,
        label: `${baseLabel} ${index + 1}`,
        status: statusByKey[key] ?? "stopped",
        launcher: "process",
        scriptPath: basePath,
        commandLabel: `${commandLabel} ${index + 1}`,
        ...overrides[key],
      };
    }
  }

  return baseSnapshot;
}

const stoppedSnapshot: MockSnapshot = createSnapshot();

const launchedSnapshot: MockSnapshot = createSnapshot(
  {
    red_miner_1: "starting",
    blue_miner_1: "running",
    validator_1: "starting",
  },
  {
    red_miner_1: {
      launchedAt: "2026-03-30T10:00:01.000Z",
      pid: 4101,
      logPath: "/tmp/red-1.log",
    },
    blue_miner_1: {
      launchedAt: "2026-03-30T10:00:02.000Z",
      pid: 4102,
      logPath: "/tmp/blue-1.log",
    },
    validator_1: {
      launchedAt: "2026-03-30T10:00:03.000Z",
      pid: 4103,
      logPath: "/tmp/validator-1.log",
    },
  },
);

const polledSnapshot: MockSnapshot = {
  ...launchedSnapshot,
  red_miner_1: {
    ...launchedSnapshot.red_miner_1,
    status: "running",
  },
  validator_1: {
    ...launchedSnapshot.validator_1,
    status: "failed",
    lastKnownError: "validator launch exploded",
    debugLogTail:
      "validator.py: line 18: /tmp/missing-python: No such file or directory",
  },
};

const blockedLaunchResponse: MockResponsePayload = {
  services: stoppedSnapshot,
  launchStarted: false,
  preflight: {
    ready: false,
    checkedAt: "2026-03-30T10:00:00.000Z",
    chainEndpoint: "wss://test.finney.opentensor.ai:443",
    netuid: 2,
    readmePath: "/Users/cavine/Code/Talos/subnet/README.md",
    blockers: [
      {
        code: "subnet_missing",
        title: "Register neurons on the testnet subnet",
        detail: "The testnet is reachable, but neurons are not registered yet.",
        readmeStep: "Step 3",
        commands: ["./scripts/testnet/00_register_neurons.sh"],
      },
      {
        code: "wallets_unregistered",
        title: "Register the required miners and validators",
        detail: "The required hotkeys are not registered on the testnet subnet, so the launch is blocked.",
        readmeStep: "Step 3",
        commands: ["./scripts/testnet/00_register_neurons.sh"],
        affectedWallets: ["test-validator-1", "test-red-miner-1"],
      },
      {
        code: "validators_unstaked",
        title: "Stake the validator wallets",
        detail: "Validators need stake before the control panel can launch them.",
        readmeStep: "Step 5",
        commands: ["./scripts/testnet/05_stake_validators.sh"],
        affectedWallets: ["test-validator-1"],
      },
    ],
  },
};

function createDeferredStep(response: MockResponsePayload): DeferredStep {
  return {
    type: "deferred",
    response,
  };
}

function createErrorStep(message: string): ErrorStep {
  return {
    type: "error",
    message,
  };
}

function createFetchMock(steps: FetchStep[]) {
  const calls: FetchCall[] = [];
  const deferredResolutions: Array<() => void> = [];

  const fetchMock: typeof fetch = async (input, init) => {
    const nextStep = steps.shift();

    if (!nextStep) {
      throw new Error("Unexpected fetch call");
    }

    const url = typeof input === "string" ? input : input.toString();
    calls.push({
      url,
      method: init?.method ?? "GET",
    });

    if ("type" in nextStep && nextStep.type === "error") {
      throw new Error(nextStep.message);
    }

    if ("type" in nextStep && nextStep.type === "deferred") {
      await new Promise<void>((resolve) => {
        deferredResolutions.push(resolve);
      });

      return {
        ok: true,
        status: 200,
        json: async () => nextStep.response,
      } as Response;
    }

    return {
      ok: true,
      status: 200,
      json: async () => nextStep,
    } as Response;
  };

  return { calls, deferredResolutions, fetchMock };
}

function getTextContent(container: HTMLElement) {
  return container.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function getLaunchButton(container: HTMLElement, dom: JSDOM) {
  const launchButton = Array.from(container.querySelectorAll("button")).find((button) =>
    button.textContent?.match(/Launch Campaign|Launching|Starting Services/i),
  );
  assert.ok(launchButton instanceof dom.window.HTMLButtonElement);
  return launchButton;
}

function setupDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });

  globalThis.window = dom.window as typeof globalThis.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: dom.window.navigator,
  });
  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: dom.window.HTMLElement,
  });
  Object.defineProperty(globalThis, "Node", {
    configurable: true,
    value: dom.window.Node,
  });
  Object.defineProperty(globalThis, "Event", {
    configurable: true,
    value: dom.window.Event,
  });
  Object.defineProperty(globalThis, "MouseEvent", {
    configurable: true,
    value: dom.window.MouseEvent,
  });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  const container = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(container);

  return { container, dom };
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

test("rehydrates service rows from GET /api/campaign/status on mount", async () => {
  const { container, dom } = setupDom();
  const root = createRoot(container);
  const originalFetch = globalThis.fetch;
  const { calls, fetchMock } = createFetchMock([{ services: stoppedSnapshot }]);

  globalThis.fetch = fetchMock;

  try {
    await act(async () => {
      root.render(<TargetSetup statusPollIntervalMs={10} />);
      await wait(0);
    });

    const text = getTextContent(container);
    assert.match(text, /Red Miner 1/);
    assert.match(text, /Blue Miner 1/);
    assert.match(text, /Validator 1/);
    assert.match(text, /Services: 3 total/);
    assert.deepEqual(calls, [{ url: "/api/campaign/status", method: "GET" }]);
  } finally {
    await act(async () => {
      root.unmount();
    });
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
});

test("preserves the API URL locally, launches the campaign, and polls for refreshed service state", async () => {
  const { container, dom } = setupDom();
  const root: Root = createRoot(container);
  const originalFetch = globalThis.fetch;
  const { calls, fetchMock } = createFetchMock([
    { services: stoppedSnapshot },
    { services: launchedSnapshot },
    { services: polledSnapshot },
  ]);

  globalThis.fetch = fetchMock;

  try {
    await act(async () => {
      root.render(<TargetSetup statusPollIntervalMs={10} />);
      await wait(0);
    });

    const input = container.querySelector("input");
    assert.ok(input instanceof dom.window.HTMLInputElement);

    await act(async () => {
      input.value = "https://client.example/v1";
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });

    assert.equal(input.value, "https://client.example/v1");

    const launchButton = getLaunchButton(container, dom);

    await act(async () => {
      launchButton.click();
      await wait(0);
    });

    assert.equal(launchButton.disabled, true);
    assert.match(launchButton.textContent ?? "", /Starting Services/i);
    assert.match(getTextContent(container), /Starting/);

    await act(async () => {
      await wait(20);
    });

    const text = getTextContent(container);
    assert.match(text, /Running/);
    assert.match(text, /Failed/);
    assert.match(text, /Red Miner 1/);
    assert.match(text, /Validator 1/);
    assert.match(text, /validator launch exploded/);
    assert.match(text, /No such file or directory/);
    assert.equal(launchButton.disabled, false);
    assert.match(launchButton.textContent ?? "", /Launch Campaign/i);

    assert.deepEqual(calls, [
      { url: "/api/campaign/status", method: "GET" },
      { url: "/api/campaign/launch", method: "POST" },
      { url: "/api/campaign/status", method: "GET" },
    ]);
  } finally {
    await act(async () => {
      root.unmount();
    });
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
});

test("keeps startup polling resilient across a transient status failure and prevents overlapping polls", async () => {
  const { container, dom } = setupDom();
  const root: Root = createRoot(container);
  const originalFetch = globalThis.fetch;
  const deferredPoll = createDeferredStep({ services: launchedSnapshot });
  const deferredRecovery = createDeferredStep({ services: polledSnapshot });
  const { calls, deferredResolutions, fetchMock } = createFetchMock([
    { services: stoppedSnapshot },
    { services: launchedSnapshot },
    deferredPoll,
    createErrorStep("temporary status outage"),
    deferredRecovery,
  ]);

  globalThis.fetch = fetchMock;

  try {
    await act(async () => {
      root.render(<TargetSetup statusPollIntervalMs={10} />);
      await wait(0);
    });

    const launchButton = getLaunchButton(container, dom);

    await act(async () => {
      launchButton.click();
      await wait(0);
    });

    assert.equal(launchButton.disabled, true);
    assert.match(launchButton.textContent ?? "", /Starting Services/i);

    await act(async () => {
      await wait(35);
    });

    assert.deepEqual(calls, [
      { url: "/api/campaign/status", method: "GET" },
      { url: "/api/campaign/launch", method: "POST" },
      { url: "/api/campaign/status", method: "GET" },
    ]);

    await act(async () => {
      deferredResolutions[0]?.();
      await wait(0);
    });

    await act(async () => {
      await wait(15);
    });

    assert.equal(launchButton.disabled, true);
    assert.match(getTextContent(container), /temporary status outage/);
    assert.deepEqual(calls, [
      { url: "/api/campaign/status", method: "GET" },
      { url: "/api/campaign/launch", method: "POST" },
      { url: "/api/campaign/status", method: "GET" },
      { url: "/api/campaign/status", method: "GET" },
      { url: "/api/campaign/status", method: "GET" },
    ]);

    await act(async () => {
      deferredResolutions[1]?.();
      await wait(20);
    });

    assert.equal(launchButton.disabled, false);
    assert.match(launchButton.textContent ?? "", /Launch Campaign/i);
    assert.doesNotMatch(getTextContent(container), /temporary status outage/);
  } finally {
    await act(async () => {
      root.unmount();
    });
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
});

test("shows bootstrap guidance when launch is blocked by missing testnet prerequisites", async () => {
  const { container, dom } = setupDom();
  const root: Root = createRoot(container);
  const originalFetch = globalThis.fetch;
  const { calls, fetchMock } = createFetchMock([
    { services: stoppedSnapshot },
    blockedLaunchResponse,
  ]);

  globalThis.fetch = fetchMock;

  try {
    await act(async () => {
      root.render(<TargetSetup statusPollIntervalMs={10} />);
      await wait(0);
    });

    const launchButton = getLaunchButton(container, dom);

    await act(async () => {
      launchButton.click();
      await wait(0);
    });

    const text = getTextContent(container);
    assert.equal(launchButton.disabled, false);
    assert.match(launchButton.textContent ?? "", /Launch Campaign/i);
    assert.match(text, /Launch blocked/i);
    assert.match(text, /subnet\/README\.md/i);
    assert.match(text, /Register neurons on the testnet subnet/i);
    assert.match(text, /Register the required miners and validators/i);
    assert.match(text, /Stake the validator wallets/i);
    assert.match(text, /scripts\/testnet\/00_register_neurons\.sh/i);
    assert.match(text, /scripts\/testnet\/05_stake_validators\.sh/i);
    assert.match(text, /test-validator-1/i);
    assert.match(text, /test-red-miner-1/i);
    assert.deepEqual(calls, [
      { url: "/api/campaign/status", method: "GET" },
      { url: "/api/campaign/launch", method: "POST" },
    ]);
  } finally {
    await act(async () => {
      root.unmount();
    });
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
});
