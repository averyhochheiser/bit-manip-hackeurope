import { DashboardPreview } from "@/components/marketing/dashboard-preview";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { StorySection } from "@/components/marketing/story-section";
import { WhyDifferent } from "@/components/marketing/why-different";
import { Footer } from "@/components/marketing/footer";
import Link from "next/link";

export default function MarketingPage() {
  return (
    <main className="relative min-h-screen bg-[#23282E] overflow-x-hidden">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.05] bg-[#23282E]/80 backdrop-blur-xl transition-all duration-300">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 sm:px-8 lg:px-12">
          <div className="flex items-center gap-4">
            <p className="font-display text-sm font-bold uppercase tracking-[0.25em] text-[#FFF8F0]">
              Carbon Gate
            </p>
            <span className="rounded-full border border-sage/40 bg-sage/20 px-2.5 py-0.5 text-[10px] font-bold text-sage backdrop-blur-md">
              BETA
            </span>
          </div>
          <nav className="flex items-center gap-8">
            <Link
              href="/dashboard"
              className="text-xs font-semibold uppercase tracking-widest text-[#FFF8F0]/60 transition hover:text-[#FFF8F0]"
            >
              Dashboard
            </Link>
            <Link
              href="/settings"
              className="text-xs font-semibold uppercase tracking-widest text-[#FFF8F0]/60 transition hover:text-[#FFF8F0]"
            >
              Settings
            </Link>
            <Link
              href="/dashboard"
              className="hidden sm:inline-flex items-center rounded-full border border-sage/30 bg-sage/10 px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-sage transition hover:bg-sage/20 hover:border-sage/50"
            >
              Sign In with GitHub
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero — full-viewport experience */}
      <Hero />

      {/* Below the fold — Jet Black (#23282E) */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-0 bg-noise opacity-40" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <WhyDifferent />
        </div>

        <HowItWorks />

        <StorySection />

        <div className="relative mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <DashboardPreview />
        </div>
      </div>

      <Footer />
    </main>
  );
}
