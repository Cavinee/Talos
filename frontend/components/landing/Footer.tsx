import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-surface border-t border-border py-6 px-8">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <span className="text-accent font-bold tracking-wider">TALOS</span>
          <span className="text-text-secondary text-sm ml-4">&copy; 2026 Talos Network</span>
        </div>
        <div className="flex flex-row gap-6">
          <span className="text-text-secondary hover:text-text-primary transition-colors text-sm cursor-default">
            GitHub
          </span>
          <Link href="/dashboard" className="text-text-secondary hover:text-text-primary transition-colors text-sm">
            Dashboard
          </Link>
        </div>
      </div>
    </footer>
  );
}
