"use client";

import React, { useEffect, useRef, useState } from "react";

import type {
  CampaignServiceKey,
  CampaignServiceSnapshot,
  CampaignServiceState,
  CampaignServiceStatus,
} from "@/lib/campaign/types";

const SERVICE_ORDER: CampaignServiceKey[] = [
  "local_chain",
  "red_miner",
  "blue_miner",
  "validator",
];

const DEFAULT_POLL_INTERVAL_MS = 3000;

const DEFAULT_SNAPSHOT: CampaignServiceSnapshot = {
  local_chain: {
    service: "local_chain",
    label: "Local Chain",
    status: "stopped",
    launcher: "docker",
    scriptPath: "",
    commandLabel: "docker run local_chain",
    containerName: "local_chain",
  },
  red_miner: {
    service: "red_miner",
    label: "Red Miner",
    status: "stopped",
    launcher: "process",
    scriptPath: "",
    commandLabel: "red miner",
  },
  blue_miner: {
    service: "blue_miner",
    label: "Blue Miner",
    status: "stopped",
    launcher: "process",
    scriptPath: "",
    commandLabel: "blue miner",
  },
  validator: {
    service: "validator",
    label: "Validator",
    status: "stopped",
    launcher: "process",
    scriptPath: "",
    commandLabel: "validator",
  },
};

type CampaignStatusResponse = {
  services: CampaignServiceSnapshot | null;
  error?: string;
};

const badgeClassNames: Record<CampaignServiceStatus, string> = {
  running: "bg-success/10 text-success",
  starting: "bg-accent/10 text-accent animate-pulse-chip",
  stopped: "border border-border text-text-secondary",
  failed: "bg-danger/10 text-danger",
};

const badgeLabels: Record<CampaignServiceStatus, string> = {
  running: "Running",
  starting: "Starting",
  stopped: "Stopped",
  failed: "Failed",
};

function shouldPoll(snapshot: CampaignServiceSnapshot) {
  return Object.values(snapshot).some((service) => service.status === "starting");
}

function formatServiceDetail(service: CampaignServiceState) {
  if (service.status === "failed") {
    return service.lastKnownError ?? "Launch failed. Check the service logs.";
  }

  if (service.status === "stopped") {
    return "Awaiting launch";
  }

  if (service.launcher === "docker") {
    if (service.containerId) {
      return `Container ${service.containerId}`;
    }

    if (service.containerName) {
      return `Container ${service.containerName}`;
    }
  }

  if (service.pid) {
    return `PID ${service.pid}`;
  }

  if (service.logPath) {
    return service.logPath;
  }

  return service.commandLabel;
}

interface TargetSetupProps {
  statusPollIntervalMs?: number;
}

export default function TargetSetup({
  statusPollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: TargetSetupProps) {
  const [url, setUrl] = useState("");
  const [services, setServices] = useState<CampaignServiceSnapshot>(DEFAULT_SNAPSHOT);
  const [isLaunching, setIsLaunching] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const pollingTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const servicesRef = useRef(services);
  const refreshStatusRef = useRef<() => Promise<void>>(async () => {});
  const statusRequestInFlightRef = useRef(false);
  const queuedRefreshRef = useRef(false);
  const statusEpochRef = useRef(0);

  const isStartupActive = shouldPoll(services);

  function stopPolling() {
    if (pollingTimerRef.current !== null) {
      window.clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }

  function ensurePolling() {
    if (pollingTimerRef.current === null) {
      pollingTimerRef.current = window.setInterval(() => {
        void refreshStatusRef.current();
      }, statusPollIntervalMs);
    }
  }

  function applySnapshot(snapshot: CampaignServiceSnapshot) {
    if (!mountedRef.current) {
      return;
    }

    servicesRef.current = snapshot;
    setServices(snapshot);

    if (shouldPoll(snapshot)) {
      ensurePolling();
      return;
    }

    stopPolling();
  }

  async function parseCampaignResponse(
    response: Response,
  ): Promise<CampaignStatusResponse> {
    return (await response.json()) as CampaignStatusResponse;
  }

  async function refreshStatus() {
    if (statusRequestInFlightRef.current) {
      queuedRefreshRef.current = true;
      return;
    }

    statusRequestInFlightRef.current = true;
    const requestEpoch = statusEpochRef.current;

    try {
      const response = await fetch("/api/campaign/status");
      const payload = await parseCampaignResponse(response);

      if (!mountedRef.current || requestEpoch !== statusEpochRef.current) {
        return;
      }

      if (payload.services) {
        setRequestError(null);
        applySnapshot(payload.services);
        return;
      }

      setRequestError(payload.error ?? "Unable to load campaign status.");
      if (shouldPoll(servicesRef.current)) {
        ensurePolling();
        return;
      }

      stopPolling();
    } catch (error) {
      if (!mountedRef.current || requestEpoch !== statusEpochRef.current) {
        return;
      }

      setRequestError(
        error instanceof Error ? error.message : "Unable to load campaign status.",
      );

      if (shouldPoll(servicesRef.current)) {
        ensurePolling();
        return;
      }

      stopPolling();
    } finally {
      statusRequestInFlightRef.current = false;

      if (queuedRefreshRef.current && mountedRef.current) {
        queuedRefreshRef.current = false;
        void refreshStatusRef.current();
      }
    }
  }

  refreshStatusRef.current = refreshStatus;

  async function launchCampaign() {
    if (isLaunching || isStartupActive) {
      return;
    }

    setIsLaunching(true);
    setRequestError(null);
    statusEpochRef.current += 1;

    try {
      const response = await fetch("/api/campaign/launch", {
        method: "POST",
      });
      const payload = await parseCampaignResponse(response);

      if (!mountedRef.current) {
        return;
      }

      if (payload.services) {
        applySnapshot(payload.services);
        return;
      }

      setRequestError(payload.error ?? "Unable to launch campaign services.");
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      setRequestError(
        error instanceof Error
          ? error.message
          : "Unable to launch campaign services.",
      );
    } finally {
      if (mountedRef.current) {
        setIsLaunching(false);
      }
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    void refreshStatusRef.current();

    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, []);

  return (
    <section className="bg-card border border-border rounded-lg p-6 space-y-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-text-primary text-xl font-semibold">
            Campaign Control Panel
          </h2>
          <p className="text-text-secondary text-sm">
            Launch the localnet stack and monitor the chain, miners, and validator
            from one operator console. The client API URL stays local for now so we
            can wire the future target endpoint without altering the live services.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-base px-3 py-2 text-xs text-text-secondary">
          Services: local chain, red miner, blue miner, validator
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="space-y-4">
          <div>
            <label className="text-text-secondary text-sm mb-1 block">
              Client API URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://api.client.ai/v1/inference"
              className="w-full bg-base border border-border rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent"
            />
            <p className="text-xs text-text-secondary mt-2">
              Stored only in this form while this page stays mounted.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                void launchCampaign();
              }}
              disabled={isLaunching || isStartupActive}
              className="bg-accent hover:bg-accent-light disabled:bg-accent/60 disabled:cursor-wait text-base font-semibold px-6 py-2.5 rounded-lg transition-colors"
            >
              {isLaunching || isStartupActive
                ? "Starting Services..."
                : "Launch Campaign"}
            </button>
            <span className="text-xs text-text-secondary">
              Status auto-refreshes while services are active.
            </span>
          </div>

          {requestError ? (
            <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
              {requestError}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {SERVICE_ORDER.map((serviceKey) => {
            const service = services[serviceKey];

            return (
              <article
                key={service.service}
                className="rounded-lg border border-border bg-base p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-text-primary text-sm font-semibold">
                      {service.label}
                    </h3>
                    <p className="text-text-secondary text-xs mt-1">
                      {service.commandLabel}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeClassNames[service.status]}`}
                  >
                    {badgeLabels[service.status]}
                  </span>
                </div>

                <p
                  className={`mt-4 text-sm ${
                    service.status === "failed"
                      ? "text-danger"
                      : "text-text-secondary"
                  }`}
                >
                  {formatServiceDetail(service)}
                </p>

                {service.status === "failed" &&
                (service.debugLogTail || service.logPath) ? (
                  <div className="mt-3 rounded-lg border border-danger/20 bg-danger/5 p-3">
                    {service.logPath ? (
                      <p className="text-[11px] text-text-secondary break-all">
                        Log: {service.logPath}
                      </p>
                    ) : null}
                    {service.debugLogTail ? (
                      <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] text-danger">
                        {service.debugLogTail}
                      </pre>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
