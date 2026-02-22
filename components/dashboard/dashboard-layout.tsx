"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GitBranch, Leaf, Settings, ShieldCheck, Bell, Trophy, LogOut } from "lucide-react";
import { motion } from "framer-motion";

export function DashboardLayout({
  children,
  title,
  subtitle,
  userName,
  userAvatarUrl,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  userName?: string;
  userAvatarUrl?: string;
}) {
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard", label: "Overview", icon: ShieldCheck },
    { href: "/dashboard/repos", label: "Repos", icon: GitBranch },
    { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#16191d] text-floral">
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-[0.25]" />
      <div className="pointer-events-none absolute -left-1/4 -top-1/4 h-1/2 w-1/2 rounded-full bg-sage/[0.03] blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full bg-crusoe/[0.03] blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-6 border-b border-white/[0.05] pb-6">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] border border-white/[0.08] transition-all group-hover:scale-110 group-hover:border-sage/30">
                <Leaf size={16} className="text-sage" />
              </div>
              <div>
                <p className="font-display text-[10px] font-bold uppercase tracking-[0.25em] text-floral/40 transition group-hover:text-floral/70">
                  Carbon Gate
                </p>
                <div className="h-[1px] w-0 bg-sage transition-all group-hover:w-full" />
              </div>
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href as any}
                    className={`relative flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all hover:bg-white/[0.04] ${isActive ? "text-floral" : "text-floral/40"}`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="nav-active"
                        className="absolute inset-0 rounded-xl bg-white/[0.05] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <item.icon size={16} className={isActive ? "text-sage" : "text-floral/40"} />
                    <span className="relative z-10">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-sage/20 bg-sage/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-sage md:flex">
              <span className="h-1 w-1 rounded-full bg-sage animate-pulse" />
              EU CBAM Aligned
            </div>

            <button className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.02] text-floral/40 transition hover:bg-white/[0.05] hover:text-floral">
              <Bell size={18} />
            </button>

            {userName && (
              <div className="flex items-center gap-2">
                {userAvatarUrl ? (
                  <img
                    src={userAvatarUrl}
                    alt={userName}
                    className="h-8 w-8 rounded-full border border-white/[0.1]"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.05] text-xs font-bold text-floral/60">
                    {userName[0].toUpperCase()}
                  </div>
                )}
                <span className="hidden text-xs font-medium text-floral/50 md:block">{userName}</span>
              </div>
            )}

            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                title="Sign out"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.02] text-floral/40 transition hover:bg-white/[0.05] hover:text-floral"
              >
                <LogOut size={16} />
              </button>
            </form>
          </div>
        </header>

        <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold tracking-tight text-floral">{title}</h1>
            <p className="mt-1 text-sm text-floral/50">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
