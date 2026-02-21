import { DashboardPreview } from "@/components/marketing/dashboard-preview";
import { Hero } from "@/components/marketing/hero";
import { StorySection } from "@/components/marketing/story-section";
import { WhyDifferent } from "@/components/marketing/why-different";

export default function MarketingPage() {
  return (
    <main className="relative min-h-screen bg-canvas">
      <header className="absolute inset-x-0 top-0 z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-8 lg:px-12">
        <p className="text-[10px] uppercase tracking-widest text-ink-muted">
          Carbon Gate
        </p>
        <div className="rounded border-[0.5px] border-border-subtle px-4 py-2 text-[10px] uppercase tracking-widest text-ink-muted">
          GitHub Action + Stripe Metered Billing
        </div>
      </header>

      <Hero />

      <div className="relative">
        <div className="mx-auto max-w-7xl px-6 lg:px-12">
          <WhyDifferent />
        </div>

        <StorySection />

        <div className="mx-auto max-w-7xl px-6 pb-24 lg:px-12">
          <DashboardPreview />
        </div>
      </div>
    </main>
  );
}
