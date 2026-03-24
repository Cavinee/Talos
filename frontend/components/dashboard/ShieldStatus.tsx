import { dashboardMetrics } from "@/data/mock";

export default function ShieldStatus() {
  return (
    <div className="bg-card border border-border rounded-lg px-5 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-text-secondary text-sm">Production Model</span>
        <span className="w-2 h-2 rounded-full bg-success inline-block" />
        <span className="text-success text-sm">Active</span>
      </div>
      <span className="font-mono text-text-secondary text-xs truncate max-w-[300px]">
        {dashboardMetrics.modelHash}
      </span>
    </div>
  );
}
