"use client";

import { motion } from "framer-motion";
import { threatStream } from "@/data/mock";

const attackTypeStyles: Record<string, string> = {
  prompt_injection: "bg-accent/20 text-accent",
  jailbreak: "bg-danger/20 text-danger",
  DAN: "bg-warning/20 text-warning",
  role_hijack: "bg-blue-faction/20 text-blue-faction",
};

const attackTypeLabels: Record<string, string> = {
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

const statusStyles: Record<string, string> = {
  blocked: "bg-success/10 text-success",
  flagged: "bg-warning/10 text-warning",
  passed: "bg-border text-text-secondary",
};

export default function ThreatTable() {
  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <table className="w-full">
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
          {threatStream.map((entry, index) => (
            <motion.tr
              key={entry.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className={index % 2 === 0 ? "bg-card" : "bg-surface/30"}
            >
              <td className="text-text-secondary text-xs py-2 px-4 whitespace-nowrap">{entry.timestamp}</td>
              <td className="text-text-primary text-sm py-2 px-4 max-w-[300px]">
                <span className="truncate block">
                  {entry.payload.length > 45 ? entry.payload.slice(0, 45) + "..." : entry.payload}
                </span>
              </td>
              <td className="py-2 px-4">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${attackTypeStyles[entry.attackType]}`}>
                  {attackTypeLabels[entry.attackType]}
                </span>
              </td>
              <td className="py-2 px-4">
                <div className="flex items-center gap-2">
                  <span className="text-text-primary text-sm w-8">{entry.threatScore}</span>
                  <div className="w-16 h-1.5 bg-border rounded-full">
                    <div
                      className={`h-full rounded-full ${scoreColor(entry.threatScore)}`}
                      style={{ width: `${entry.threatScore}%` }}
                    />
                  </div>
                </div>
              </td>
              <td className="py-2 px-4">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[entry.status]}`}>
                  {entry.status}
                </span>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
