"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard", label: "Overview", icon: ShieldCheck },
    { href: "/dashboard/repos", label: "Repos", icon: GitBranch },
    { href: "/dashboard/teams", label: "Teams", icon: Users },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <main className="min-h-screen bg-[#23282E] text-[#FFF8F0]">
      <div className="mx-auto max-w-7xl border-x-[0.5px] border-[#FFF8F0]/10">
        <header className="flex flex-wrap items-end justify-between border-b-[0.5px] border-[#FFF8F0]/10 p-6 lg:p-12">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#FFF8F0]/50">
              Carbon Gate
            </p>
            <h1 className="mt-4 text-2xl font-normal tracking-tight text-[#FFF8F0]">
              {title}
            </h1>
            <p className="mt-2 text-sm font-light text-[#FFF8F0]/60">
              {subtitle}
            </p>
          </div>
          <nav className="flex items-center gap-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href as any}
                  className={`inline-flex items-center gap-2 border-[0.5px] border-[#FFF8F0]/10 bg-[#2A2F35] px-4 py-2.5 text-[10px] uppercase tracking-widest transition-colors hover:bg-[#353B42] ${
                    isActive ? "text-[#FFF8F0]" : "text-[#FFF8F0]/50"
                  }`}
                >
                  <Icon size={14} strokeWidth={1} />
                  {item.label}
                </Link>
              );
            })}
            <div className="inline-flex items-center gap-2 border-[0.5px] border-stoneware-green/30 bg-stoneware-green/10 px-4 py-2.5 text-[10px] uppercase tracking-widest text-stoneware-green">
              <Leaf size={14} strokeWidth={1} />
              EU CBAM aligned
            </div>
          </nav>
        </header>
        <div className="flex flex-col border-b-[0.5px] border-[#FFF8F0]/10">
          {children}
        </div>
      </div>
    </main>
  );
}
