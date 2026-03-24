"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface MetricCardProps {
  title: string;
  value: number;
  suffix?: string;
  maxValue?: number;
  icon: React.ReactNode;
  delay?: number;
}

export default function MetricCard({ title, value, suffix, maxValue, icon, delay = 0 }: MetricCardProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 1000;
    const startTime = performance.now();

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(eased * value);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
  }, [value]);

  const isInteger = Number.isInteger(value);
  const formatted = isInteger ? Math.round(displayValue).toLocaleString() : displayValue.toFixed(1);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay, ease: "easeOut" }}
      className="bg-card border border-border rounded-lg p-5 relative flex-1 min-w-0"
    >
      <div className="absolute top-5 right-5 text-text-secondary">{icon}</div>
      <p className="text-text-secondary text-sm">{title}</p>
      <p className="text-text-primary text-3xl font-bold mt-1">
        {formatted}
        {suffix && <span className="text-lg font-normal ml-1">{suffix}</span>}
      </p>
      {maxValue !== undefined && (
        <div className="w-full h-1.5 bg-border rounded-full mt-3">
          <div
            className="h-full bg-accent rounded-full transition-all duration-1000"
            style={{ width: `${(value / maxValue) * 100}%` }}
          />
        </div>
      )}
    </motion.div>
  );
}
