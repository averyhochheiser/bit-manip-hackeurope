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
    <main className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto max-w-7xl border-x-[0.5px] border-border-subtle">
        <header className="flex flex-wrap items-end justify-between border-b-[0.5px] border-border-subtle p-6 lg:p-12">
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
              className="inline-flex items-center gap-2 border-[0.5px] border-border-subtle bg-canvas px-4 py-2.5 text-[10px] uppercase tracking-widest text-ink-muted transition-colors hover:bg-canvas-raised"
            >
              <ShieldCheck size={14} strokeWidth={1} />
              Dashboard
            </Link>
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 border-[0.5px] border-border-subtle bg-canvas px-4 py-2.5 text-[10px] uppercase tracking-widest text-ink-muted transition-colors hover:bg-canvas-raised"
            >
              <Settings size={14} strokeWidth={1} />
              Settings
            </Link>
            <div className="inline-flex items-center gap-2 border-[0.5px] border-stoneware-green/30 bg-stoneware-green/5 px-4 py-2.5 text-[10px] uppercase tracking-widest text-stoneware-green">
              <Leaf size={14} strokeWidth={1} />
              EU CBAM aligned
            </div>
          </nav>
        </header>
        <div className="flex flex-col border-b-[0.5px] border-border-subtle">
          {children}
        </div>
      </div>
    </main>
  );
}
