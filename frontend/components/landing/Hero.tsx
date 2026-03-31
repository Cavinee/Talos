"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";

export default function Hero() {
  return (
    <section
      className="min-h-screen flex items-center px-8"
      style={{
        backgroundImage: "radial-gradient(circle, #2a2a3a 1px, transparent 1px)",
        backgroundSize: "30px 30px",
        opacity: 1,
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: 0.4 }}
      />

      <div className="flex w-full max-w-7xl mx-auto relative z-10">
        <motion.div
          className="flex-[3] space-y-6 flex flex-col justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <h1 className="text-text-primary text-5xl font-bold leading-tight">
            Adversarial AI Security for the Decentralized Era
          </h1>
          <p className="text-text-secondary text-lg max-w-lg">
            Decentralized threat detection powered by competitive AI miners on Bittensor Subnet
          </p>
          <div className="flex gap-4">
            <Link
              href="/dashboard"
              className="bg-accent hover:bg-accent-light text-base font-semibold px-8 py-3 rounded-lg transition-colors"
            >
              Launch Dashboard
            </Link>
          </div>
        </motion.div>

        <motion.div
          className="flex-[2] relative flex items-center justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
        >
          <div
            className="absolute w-64 h-64"
            style={{
              background: "radial-gradient(circle, rgba(196,168,130,0.15) 0%, transparent 70%)",
              animation: "pulse-glow 3s ease-in-out infinite",
            }}
          />

          <ShieldCheck size={120} className="text-accent relative z-10" />

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-0 h-0">
              <div
                className="absolute w-2 h-2 rounded-full bg-accent/60"
                style={{ animation: "orbit 8s linear infinite", animationDelay: "0s" }}
              />
              <div
                className="absolute w-2 h-2 rounded-full bg-accent/60"
                style={{ animation: "orbit 8s linear infinite", animationDelay: "2s" }}
              />
              <div
                className="absolute w-2 h-2 rounded-full bg-accent/60"
                style={{ animation: "orbit 8s linear infinite", animationDelay: "4s" }}
              />
              <div
                className="absolute w-2 h-2 rounded-full bg-accent/60"
                style={{ animation: "orbit 8s linear infinite", animationDelay: "6s" }}
              />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
