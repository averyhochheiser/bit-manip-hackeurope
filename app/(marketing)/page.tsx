import { DashboardPreview } from "@/components/marketing/dashboard-preview";
import { Hero } from "@/components/marketing/hero";
import { StorySection } from "@/components/marketing/story-section";
import { WhyDifferent } from "@/components/marketing/why-different";

export default function MarketingPage() {
  return (
    <main className="relative min-h-screen bg-[#23282E]">
      {/* Header — floats above the hero background */}
      <header className="absolute inset-x-0 top-0 z-10 mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
        <p className="font-display text-xs font-medium uppercase tracking-[0.2em] text-[#FFF8F0]/60">
          Carbon Gate
        </p>
        <div className="rounded-full border border-[#FFF8F0]/15 bg-[#FFF8F0]/5 px-3 py-1 text-xs text-[#FFF8F0]/75">
          GitHub Action + Stripe Metered Billing
        </div>
      </header>

      {/* Hero — full-viewport, absolute-positioned experience */}
      <Hero />

      {/* Below the fold — Jet Black (#23282E) */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-0 bg-noise opacity-40" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <WhyDifferent />
        </div>

        <StorySection />

        <div className="relative mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <DashboardPreview />
        </div>
      </div>
    </main>
  );
}
