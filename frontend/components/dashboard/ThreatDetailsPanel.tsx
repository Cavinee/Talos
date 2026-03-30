"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import type { ThreatEntry } from "@/data/mock";

interface ThreatDetailsPanelProps {
  threat: ThreatEntry | null;
  mode: "desktop" | "mobile";
  isOpen?: boolean;
  onClose?: () => void;
}

const classificationStyles: Record<ThreatEntry["blueClassification"], string> = {
  dangerous: "bg-danger/10 text-danger",
  safe: "bg-success/10 text-success",
  unknown: "bg-warning/10 text-warning",
};

const classificationLabels: Record<ThreatEntry["blueClassification"], string> = {
  dangerous: "Dangerous",
  safe: "Safe",
  unknown: "Unknown",
};

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="text-text-primary font-medium text-right">{value}</span>
    </div>
  );
}

function MinerCard({
  title,
  accentClass,
  children,
}: {
  title: string;
  accentClass: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface/40 p-4">
      <div className={`mb-3 h-1.5 w-16 rounded-full ${accentClass}`} />
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function MinerFallback({ title, accentClass }: { title: string; accentClass: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface/40 p-4">
      <div className={`mb-3 h-1.5 w-16 rounded-full ${accentClass}`} />
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      <p className="mt-3 text-sm text-text-secondary">Miner details unavailable</p>
    </div>
  );
}

function ThreatDetailsBody({ threat }: { threat: ThreatEntry | null }) {
  if (!threat) {
    return (
      <div className="rounded-lg border border-border bg-surface/40 p-4">
        <p className="text-sm text-text-secondary">
          Select a threat to inspect miner details
        </p>
      </div>
    );
  }

  const classification = threat.blueClassification;

  return (
    <div className="space-y-5">
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Selected Prompt
        </h2>
        <p className="mt-2 rounded-lg border border-border/70 bg-surface/40 p-4 text-sm leading-6 text-text-primary whitespace-pre-wrap">
          {threat.redPrompt}
        </p>
      </section>

      <section className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-surface/40 p-4">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Blue Verdict
          </h2>
          <p className="mt-1 text-sm text-text-primary">
            {classification ? (
              <>
                The defense classified this record as{" "}
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${classificationStyles[classification]}`}
                >
                  {classificationLabels[classification]}
                </span>
                .
              </>
            ) : (
              "Classification unavailable"
            )}
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Red Miner
        </h2>
        <div className="mt-2 space-y-3">
          {threat.redMiner ? (
            <MinerCard title={`Miner ${threat.redMiner.uid}`} accentClass="bg-danger">
              <DetailRow label="Rank" value={threat.redMiner.rank} />
              <DetailRow label="Severity" value={threat.redMiner.severity.toFixed(1)} />
              <DetailRow label="Novelty" value={threat.redMiner.novelty.toFixed(1)} />
              <DetailRow label="Combined Score" value={threat.redMiner.combinedScore.toFixed(1)} />
            </MinerCard>
          ) : (
            <MinerFallback title="Red Miner" accentClass="bg-danger" />
          )}
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Blue Miner
        </h2>
        <div className="mt-2 space-y-3">
          {threat.blueMiner ? (
            <MinerCard title={`Miner ${threat.blueMiner.uid}`} accentClass="bg-blue-faction">
              <DetailRow label="Rank" value={threat.blueMiner.rank} />
              <DetailRow label="Precision" value={`${threat.blueMiner.precision.toFixed(1)}%`} />
              <DetailRow label="Recall" value={`${threat.blueMiner.recall.toFixed(1)}%`} />
              <DetailRow label="Latency" value={`${threat.blueMiner.latency.toFixed(1)} ms`} />
            </MinerCard>
          ) : (
            <MinerFallback title="Blue Miner" accentClass="bg-blue-faction" />
          )}
        </div>
      </section>
    </div>
  );
}

function DesktopThreatDetailsPanel({ threat }: { threat: ThreatEntry | null }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-5">
      <div>
        <p className="text-sm font-semibold text-text-primary">Threat Inspector</p>
        {threat ? (
          <p className="mt-1 text-xs text-text-secondary">
            {threat.id} · {threat.timestamp} · {threat.attackType}
          </p>
        ) : null}
      </div>

      <ThreatDetailsBody threat={threat} />
    </div>
  );
}

function MobileThreatDetailsPanel({
  threat,
  onClose,
}: {
  threat: ThreatEntry | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  function getFocusableElements() {
    const dialog = dialogRef.current;

    if (!dialog) {
      return [] as HTMLElement[];
    }

    return Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
  }

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  return (
    <div className="lg:hidden">
      <div
        aria-hidden="true"
        onClick={onClose}
        className={[
          "fixed inset-0 z-40 bg-surface/70 backdrop-blur-sm transition-opacity duration-300",
          "opacity-100",
        ].join(" ")}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="threat-inspector-mobile-title"
        tabIndex={-1}
        className={[
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-card shadow-2xl outline-none transition-transform duration-300 ease-out",
          "translate-x-0",
        ].join(" ")}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
            return;
          }

          if (event.key === "Tab") {
            const focusableElements = getFocusableElements();

            if (focusableElements.length === 0) {
              event.preventDefault();
              dialogRef.current?.focus();
              return;
            }

            const firstFocusable = focusableElements[0];
            const lastFocusable = focusableElements[focusableElements.length - 1];
            const activeElement = document.activeElement;

            if (event.shiftKey && activeElement === firstFocusable) {
              event.preventDefault();
              lastFocusable.focus();
            } else if (!event.shiftKey && activeElement === lastFocusable) {
              event.preventDefault();
              firstFocusable.focus();
            }
          }
        }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
          <div>
            <p id="threat-inspector-mobile-title" className="text-sm font-semibold text-text-primary">
              Threat Inspector
            </p>
            {threat ? (
              <p className="mt-1 text-xs text-text-secondary">
                {threat.id} · {threat.timestamp}
              </p>
            ) : null}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface/60 text-text-secondary transition-colors hover:text-text-primary"
            aria-label="Close threat inspector"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <ThreatDetailsBody threat={threat} />
        </div>
      </div>
    </div>
  );
}

export default function ThreatDetailsPanel({
  threat,
  mode,
  isOpen = false,
  onClose = () => {},
}: ThreatDetailsPanelProps) {
  if (mode === "desktop") {
    return <DesktopThreatDetailsPanel threat={threat} />;
  }

  if (!isOpen) {
    return null;
  }

  return <MobileThreatDetailsPanel threat={threat} onClose={onClose} />;
}
