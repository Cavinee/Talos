"use client";

import { useState, useEffect, useRef } from "react";
import { landingStats } from "@/data/mock";

function parseStatValue(value: string): { prefix: string; target: number; suffix: string; useComma: boolean } {
  if (value === "1,200+") return { prefix: "", target: 1200, suffix: "+", useComma: true };
  if (value === "3") return { prefix: "", target: 3, suffix: "", useComma: false };
  if (value === "<12ms") return { prefix: "<", target: 12, suffix: "ms", useComma: false };
  return { prefix: "", target: 0, suffix: "", useComma: false };
}

function formatNumber(n: number, useComma: boolean): string {
  if (useComma) return n.toLocaleString();
  return String(n);
}

export default function StatsBar() {
  const [animatedValues, setAnimatedValues] = useState<number[]>(landingStats.map(() => 0));
  const sectionRef = useRef<HTMLElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const duration = 1500;
          const startTime = performance.now();

          const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);

            setAnimatedValues(
              landingStats.map((stat) => {
                const { target } = parseStatValue(stat.value);
                return Math.round(eased * target);
              })
            );

            if (progress < 1) {
              requestAnimationFrame(animate);
            }
          };

          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="stats" ref={sectionRef} className="w-full bg-card border-y border-border py-16">
      <div className="max-w-4xl mx-auto flex items-center justify-around">
        {landingStats.map((stat, index) => {
          const { prefix, suffix, useComma } = parseStatValue(stat.value);
          return (
            <div key={stat.label} className="flex items-center">
              {index > 0 && <div className="bg-border h-12 w-px mr-8" />}
              <div className="text-center">
                <div className="text-accent text-4xl font-bold">
                  {prefix}
                  {formatNumber(animatedValues[index], useComma)}
                  {suffix}
                </div>
                <div className="text-text-secondary text-sm mt-1 text-center">{stat.label}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
