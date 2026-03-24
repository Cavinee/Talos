"use client";

import { motion } from "framer-motion";
import { ShieldAlert, Swords, Trophy, Code } from "lucide-react";
import { landingFeatures } from "@/data/mock";

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  ShieldAlert,
  Swords,
  Trophy,
  Code,
};

export default function FeatureCards() {
  return (
    <section id="features" className="py-20 px-8 max-w-6xl mx-auto">
      <h2 className="text-text-primary text-3xl font-bold text-center mb-12">
        What Talos Offers
      </h2>
      <div className="grid grid-cols-2 gap-6">
        {landingFeatures.map((feature, index) => {
          const Icon = iconMap[feature.icon];
          return (
            <motion.div
              key={feature.title}
              className="bg-card border border-border rounded-lg p-6"
              whileHover={{ y: -2, boxShadow: "0 8px 30px rgba(0,0,0,0.3)" }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.4, ease: "easeOut" }}
            >
              {Icon && <Icon size={32} className="text-accent mb-3" />}
              <h3 className="text-text-primary text-lg font-semibold">{feature.title}</h3>
              <p className="text-text-secondary text-sm mt-1">{feature.description}</p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
