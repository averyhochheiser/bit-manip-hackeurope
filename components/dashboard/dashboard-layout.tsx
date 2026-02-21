import Link from "next/link";
import { GitBranch, Leaf, Settings, ShieldCheck, Users } from "lucide-react";

export function DashboardLayout({
  children,
  title,
  subtitle
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gate-bg text-floral">
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-40" />
      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-display text-xs font-medium uppercase tracking-[0.22em] text-floral/55">Carbon Gate</p>
              <span className="rounded-full border border-sage/30 bg-sage/10 px-2 py-0.5 text-[10px] text-sage">Beta</span>
            </div>
            <h1 className="mt-2 font-display text-3xl font-bold text-floral">{title}</h1>
            <p className="mt-2 text-sm text-floral/65">{subtitle}</p>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg border border-floral/15 bg-floral/5 px-3 py-2 text-sm text-floral/85 transition hover:bg-floral/10"
            >
              <ShieldCheck size={16} />
              Overview
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg border border-floral/15 bg-floral/5 px-3 py-2 text-sm text-floral/85 transition hover:bg-floral/10"
            >
              <GitBranch size={16} />
              Repos
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg border border-floral/15 bg-floral/5 px-3 py-2 text-sm text-floral/85 transition hover:bg-floral/10"
            >
              <Users size={16} />
              Teams
            </Link>
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 rounded-lg border border-floral/15 bg-floral/5 px-3 py-2 text-sm text-floral/85 transition hover:bg-floral/10"
            >
              <Settings size={16} />
              Settings
            </Link>
            <div className="inline-flex items-center gap-2 rounded-lg border border-sage/30 bg-sage/10 px-3 py-2 text-xs text-sage">
              <Leaf size={14} />
              EU CBAM aligned
            </div>
          </nav>
        </header>
        {children}
      </div>
    </main>
  );
}
