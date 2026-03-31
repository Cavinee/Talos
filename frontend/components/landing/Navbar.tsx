"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 px-8 py-4 transition-colors duration-300 ${
        scrolled ? "bg-surface/95 backdrop-blur-sm" : "bg-transparent"
      }`}
    >
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/" className="text-accent font-bold text-xl tracking-wider">
          TALOS
        </Link>

        <div className="flex items-center gap-6">
          <span
            onClick={() => scrollTo("features")}
            className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            Features
          </span>
          <span
            onClick={() => scrollTo("stats")}
            className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            Network
          </span>
          <Link
            href="/dashboard"
            className="bg-accent hover:bg-accent-light text-base font-semibold px-5 py-2 rounded-lg transition-colors"
          >
            Launch Dashboard
          </Link>
        </div>
      </div>
    </nav>
  );
}
