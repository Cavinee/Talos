"use client";

import { motion } from "framer-motion";
import type { ThreatEntry } from "@/data/mock";

const attackTypeStyles: Record<ThreatEntry["attackType"], string> = {
  prompt_injection: "bg-accent/20 text-accent",
  jailbreak: "bg-danger/20 text-danger",
  DAN: "bg-warning/20 text-warning",
  role_hijack: "bg-blue-faction/20 text-blue-faction",
};

const attackTypeLabels: Record<ThreatEntry["attackType"], string> = {
  prompt_injection: "Prompt Injection",
  jailbreak: "Jailbreak",
  DAN: "DAN",
  role_hijack: "Role Hijack",
};

function scoreColor(score: number) {
  if (score <= 33) return "bg-success";
  if (score <= 66) return "bg-warning";
  return "bg-danger";
}

const statusStyles: Record<ThreatEntry["status"], string> = {
  blocked: "bg-success/10 text-success",
  flagged: "bg-warning/10 text-warning",
  passed: "bg-border text-text-secondary",
};

interface ThreatTableProps {
  entries: ThreatEntry[];
  selectedThreatId: string | null;
  onSelectThreat: (threatId: string) => void;
}

export default function ThreatTable({ entries, selectedThreatId, onSelectThreat }: ThreatTableProps) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full">
          <thead>
            <tr className="bg-surface">
              <th className="text-left text-text-secondary text-xs font-medium py-2 px-4">Timestamp</th>
              <th className="text-left text-text-secondary text-xs font-medium py-2 px-4">Payload Preview</th>
              <th className="text-left text-text-secondary text-xs font-medium py-2 px-4">Attack Type</th>
              <th className="text-left text-text-secondary text-xs font-medium py-2 px-4">Threat Score</th>
              <th className="text-left text-text-secondary text-xs font-medium py-2 px-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => {
              const isSelected = entry.id === selectedThreatId;
              const rowBackground = index % 2 === 0 ? "bg-card" : "bg-surface/30";

              return (
                <motion.tr
                  key={entry.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  onClick={() => onSelectThreat(entry.id)}
                  className={[
                    "cursor-pointer border-b border-border/50 transition-colors duration-150 hover:bg-surface/50 focus-within:bg-surface/60 focus-within:ring-1 focus-within:ring-inset focus-within:ring-accent/40",
                    isSelected ? "bg-accent/10" : rowBackground,
                  ].join(" ")}
                  style={isSelected ? { boxShadow: "inset 3px 0 0 0 hsl(var(--accent))" } : undefined}
                >
                  <td className="text-text-secondary text-xs py-2 px-4 whitespace-nowrap">
                    <label
                      className="flex items-center gap-3 cursor-pointer"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <input
                        type="radio"
                        name="selected-threat"
                        checked={isSelected}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => onSelectThreat(entry.id)}
                        aria-label={`Select threat ${entry.id} at ${entry.timestamp}`}
                        className="h-4 w-4 accent-accent"
                      />
                      <span>{entry.timestamp}</span>
                    </label>
                  </td>
                  <td className="text-text-primary text-sm py-2 px-4 max-w-[300px]">
                    <span className="block truncate">
                      {entry.payload.length > 45 ? `${entry.payload.slice(0, 45)}...` : entry.payload}
                    </span>
                  </td>
                  <td className="py-2 px-4">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${attackTypeStyles[entry.attackType]}`}>
                      {attackTypeLabels[entry.attackType]}
                    </span>
                  </td>
                  <td className="py-2 px-4">
                    <div className="flex items-center gap-2">
                      <span className="text-text-primary text-sm w-8">{entry.threatScore}</span>
                      <div className="h-1.5 w-16 rounded-full bg-border">
                        <div
                          className={`h-full rounded-full ${scoreColor(entry.threatScore)}`}
                          style={{ width: `${entry.threatScore}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-2 px-4">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[entry.status]}`}>
                      {entry.status}
                    </span>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
