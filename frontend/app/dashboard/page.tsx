"use client";

import { useState } from "react";
import { ShieldAlert, ShieldCheck, Activity, Zap, AlertTriangle } from "lucide-react";
import MetricCard from "@/components/dashboard/MetricCard";
import ShieldStatus from "@/components/dashboard/ShieldStatus";
import ThreatTable from "@/components/dashboard/ThreatTable";
import ThreatDetailsPanel from "@/components/dashboard/ThreatDetailsPanel";
import { useLiveData } from "@/hooks/useLiveData";
import type { ThreatEntry } from "@/data/mock";

export default function DashboardPage() {
  const { data } = useLiveData<{ threats: ThreatEntry[] }>(
    "/api/threats",
    { threats: [] },
    5000
  );
  const threats = data.threats;

  const [selectedThreatId, setSelectedThreatId] = useState<string | null>(
    () => threats[0]?.id ?? null
  );
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
  const selectedThreat =
    threats.find((entry) => entry.id === selectedThreatId) ?? null;

  const totalDetected = threats.length;
  const totalBlocked = threats.filter((t) => t.status === "blocked").length;
  const blockRate =
    totalDetected > 0
      ? Math.round((totalBlocked / totalDetected) * 1000) / 10
      : 0;

  function handleSelectThreat(threatId: string) {
    setSelectedThreatId(threatId);
    setIsMobilePanelOpen(true);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">
        Threat Intelligence Dashboard
      </h1>

      <div className="flex gap-6">
        <MetricCard
          title="Total Detected"
          value={totalDetected}
          icon={<ShieldAlert size={20} />}
          delay={0}
        />
        <MetricCard
          title="Blocked"
          value={totalBlocked}
          icon={<ShieldCheck size={20} />}
          suffix=""
          delay={0.1}
        />
        <MetricCard
          title="Block Rate"
          value={blockRate}
          suffix="%"
          maxValue={100}
          icon={<Activity size={20} />}
          delay={0.2}
        />
        <MetricCard
          title="SDK Latency"
          value={11.3}
          suffix="ms"
          maxValue={50}
          icon={<Zap size={20} />}
          delay={0.3}
        />
        <MetricCard
          title="False Positive"
          value={2.1}
          suffix="%"
          maxValue={10}
          icon={<AlertTriangle size={20} />}
          delay={0.4}
        />
      </div>

      <ShieldStatus />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)] items-start">
        <ThreatTable
          entries={threats}
          selectedThreatId={selectedThreatId}
          onSelectThreat={handleSelectThreat}
        />
        <div className="hidden lg:block lg:sticky lg:top-6">
          <ThreatDetailsPanel threat={selectedThreat} mode="desktop" />
        </div>
      </div>

      <ThreatDetailsPanel
        threat={selectedThreat}
        mode="mobile"
        isOpen={isMobilePanelOpen}
        onClose={() => setIsMobilePanelOpen(false)}
      />
    </div>
  );
}
