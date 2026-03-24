"use client";

import { ShieldAlert, ShieldCheck, Activity, Zap, AlertTriangle } from "lucide-react";
import MetricCard from "@/components/dashboard/MetricCard";
import ShieldStatus from "@/components/dashboard/ShieldStatus";
import ThreatTable from "@/components/dashboard/ThreatTable";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">
        Threat Intelligence Dashboard
      </h1>

      <div className="flex gap-6">
        <MetricCard
          title="Total Detected"
          value={12847}
          icon={<ShieldAlert size={20} />}
          delay={0}
        />
        <MetricCard
          title="Blocked"
          value={12203}
          icon={<ShieldCheck size={20} />}
          suffix=""
          delay={0.1}
        />
        <MetricCard
          title="Block Rate"
          value={94.9}
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

      <ThreatTable />
    </div>
  );
}
