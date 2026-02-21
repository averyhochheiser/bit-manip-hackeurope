import { DashboardPreview } from "@/components/marketing/dashboard-preview";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { StorySection } from "@/components/marketing/story-section";
import { WhyDifferent } from "@/components/marketing/why-different";
import { Footer } from "@/components/marketing/footer";
import Link from "next/link";

export default function MarketingPage() {
  return (
    <main className="relative min-h-screen bg-[#23282E]">
      {/* Header — floats above the hero background */}
      <header className="absolute inset-x-0 top-0 z-10 mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-[#FFF8F0]/70">
            Carbon Gate
          </p>
          <span className="rounded-full border border-sage/30 bg-sage/10 px-2 py-0.5 text-[10px] font-medium text-sage">
            Beta
          </span>
        </div>
        <nav className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-xs font-medium text-[#FFF8F0]/50 transition hover:text-[#FFF8F0]/90"
          >
            Dashboard
          </Link>
          <Link
            href="/settings"
            className="text-xs font-medium text-[#FFF8F0]/50 transition hover:text-[#FFF8F0]/90"
          >
            Settings
          </Link>
          <a
            href="https://github.com/averyhochheiser/bit-manip-hackeurope"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-[#FFF8F0]/15 bg-[#FFF8F0]/5 px-3 py-1 text-xs text-[#FFF8F0]/75 transition hover:bg-[#FFF8F0]/10"
          >
            GitHub ↗
          </a>
        </nav>
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
