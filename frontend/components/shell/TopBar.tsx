"use client";

import { Bell } from "lucide-react";

export default function TopBar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 bg-surface border-b border-border h-14">
      <span className="text-accent font-bold text-lg tracking-wide">TALOS</span>
      <div className="flex items-center gap-4">
        <button className="text-text-secondary hover:text-text-primary transition-colors">
          <Bell size={20} />
        </button>
        <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent text-sm font-medium">
          T
        </div>
      </div>
    </header>
  );
}
