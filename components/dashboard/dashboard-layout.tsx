import Link from "next/link";
import { Leaf, Settings, ShieldCheck } from "lucide-react";

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
    <main className="relative min-h-screen bg-canvas text-ink">
      <div className="mx-auto max-w-7xl px-6 pb-24 pt-16 lg:px-12">
        <header className="mb-16 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-ink-muted">
              Carbon Gate
            </p>
            <h1 className="mt-4 text-2xl font-normal tracking-tight text-ink">
              {title}
            </h1>
            <p className="mt-2 text-sm font-light text-ink-muted">
              {subtitle}
            </p>
          </div>
          <nav className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded border-[0.5px] border-border-subtle px-4 py-2.5 text-[10px] uppercase tracking-widest text-ink-muted transition-colors hover:bg-canvas-raised"
            >
              <ShieldCheck size={14} strokeWidth={1} />
              Dashboard
            </Link>
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 rounded border-[0.5px] border-border-subtle px-4 py-2.5 text-[10px] uppercase tracking-widest text-ink-muted transition-colors hover:bg-canvas-raised"
            >
              <Settings size={14} strokeWidth={1} />
              Settings
            </Link>
            <div className="inline-flex items-center gap-2 rounded border-[0.5px] border-stoneware-green/30 bg-stoneware-green/5 px-4 py-2.5 text-[10px] uppercase tracking-widest text-stoneware-green">
              <Leaf size={14} strokeWidth={1} />
              EU CBAM aligned
            </div>
          </nav>
        </header>
        {children}
      </div>
    </main>
  );
}
