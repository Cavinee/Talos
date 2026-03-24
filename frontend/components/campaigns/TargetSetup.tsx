"use client";

import { useState } from "react";

export default function TargetSetup() {
  const [url, setUrl] = useState("");

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h2 className="text-text-primary text-xl font-semibold">Target Configuration</h2>
      <p className="text-text-secondary text-sm mb-4">
        Configure the target AI endpoint for adversarial testing
      </p>
      <label className="text-text-secondary text-sm mb-1 block">Client API URL</label>
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://api.client.ai/v1/inference"
        className="w-full bg-base border border-border rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent"
      />
      <button className="bg-accent hover:bg-accent-light text-base font-semibold px-6 py-2.5 rounded-lg transition-colors mt-4">
        Launch Campaign
      </button>
    </div>
  );
}
