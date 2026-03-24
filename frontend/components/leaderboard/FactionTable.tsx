"use client";

import { motion } from "framer-motion";

interface Column {
  key: string;
  label: string;
}

interface FactionTableProps {
  title: string;
  accentColor: string;
  columns: Column[];
  data: Record<string, any>[];
}

export default function FactionTable({ title, accentColor, columns, data }: FactionTableProps) {
  return (
    <div>
      <h2
        className="text-lg font-semibold mb-3"
        style={{ borderLeft: `3px solid ${accentColor}`, paddingLeft: 12, color: accentColor }}
      >
        {title}
      </h2>
      <table className="w-full bg-card rounded-lg border border-border overflow-hidden">
        <thead>
          <tr className="bg-surface">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-2 text-left text-text-secondary text-xs uppercase tracking-wider font-medium"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => {
            let rowClass = "border-b border-border/50 ";
            if (index < 3) {
              rowClass += "bg-surface/50";
            } else if (index % 2 === 0) {
              rowClass += "bg-card";
            } else {
              rowClass += "bg-base/30";
            }

            return (
              <motion.tr
                key={index}
                className={rowClass}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.03 }}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-2 text-sm text-text-primary">
                    {row[col.key]}
                  </td>
                ))}
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
