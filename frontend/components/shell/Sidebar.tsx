"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert, Swords, Trophy } from "lucide-react";

const navGroups = [
  {
    label: "INTELLIGENCE",
    items: [
      { name: "Threat Dashboard", icon: ShieldAlert, href: "/dashboard" },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      { name: "Red Team Campaign", icon: Swords, href: "/dashboard/campaigns" },
    ],
  },
  {
    label: "NETWORK",
    items: [
      { name: "Subnet Leaderboard", icon: Trophy, href: "/dashboard/leaderboard" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed top-14 left-0 w-60 h-[calc(100vh-3.5rem)] bg-surface border-r border-border overflow-y-auto">
      <nav className="py-4">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="px-5 mb-2 text-[11px] font-semibold tracking-wider text-text-secondary">
              {group.label}
            </p>
            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                    active
                      ? "border-l-[3px] border-accent bg-white/5 text-text-primary"
                      : "border-l-[3px] border-transparent text-text-secondary hover:text-text-primary hover:bg-white/[0.02]"
                  }`}
                >
                  <item.icon size={18} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
