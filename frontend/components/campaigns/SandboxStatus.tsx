"use client";

import React from "react";

const serviceNotes = [
  {
    title: "Local Chain",
    description: "Docker-backed chain service used as the base localnet.",
  },
  {
    title: "Red and Blue Miners",
    description: "Detached miner processes launched from the localnet scripts.",
  },
  {
    title: "Validator",
    description: "Validator process with failure surfacing directly in the console.",
  },
];

export default function SandboxStatus() {
  return (
    <section className="bg-card border border-border rounded-lg p-6 space-y-4">
      <div className="max-w-2xl">
        <h2 className="text-text-primary text-xl font-semibold">
          Runtime Monitoring Notes
        </h2>
        <p className="text-text-secondary text-sm">
          The live service panel above now reflects the real campaign runtime. Use
          these notes as a quick reference for what each service represents while the
          localnet is starting or recovering from failures.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {serviceNotes.map((note) => (
          <article key={note.title} className="rounded-lg border border-border bg-base p-4">
            <h3 className="text-text-primary text-sm font-semibold">{note.title}</h3>
            <p className="text-text-secondary text-sm mt-2">{note.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
