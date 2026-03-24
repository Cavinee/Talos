"use client";

import { motion } from "framer-motion";
import { Cpu, HardDrive, Shield, CheckCircle } from "lucide-react";
import { sandboxStages } from "@/data/mock";
import type { LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Cpu,
  HardDrive,
  Shield,
  CheckCircle,
};

function StatusChip({ status }: { status: "complete" | "in_progress" | "pending" }) {
  if (status === "complete") {
    return (
      <span className="bg-success/10 text-success text-xs px-2 py-0.5 rounded-full">
        Complete
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="bg-accent/10 text-accent text-xs px-2 py-0.5 rounded-full animate-pulse-chip">
        In Progress
      </span>
    );
  }
  return (
    <span className="border border-border text-text-secondary text-xs px-2 py-0.5 rounded-full">
      Pending
    </span>
  );
}

export default function SandboxStatus() {
  return (
    <div>
      <h2 className="text-text-primary text-xl font-semibold mb-4">Sandbox Provisioning</h2>
      <div className="flex gap-4">
        {sandboxStages.map((stage, i) => {
          const Icon = iconMap[stage.icon];
          return (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.15, duration: 0.4 }}
              className="bg-card border border-border rounded-lg p-4 flex-1"
            >
              {Icon && <Icon className="text-text-primary mb-2" size={20} />}
              <p className="text-text-primary text-sm font-medium mb-2">{stage.name}</p>
              <StatusChip status={stage.status} />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
