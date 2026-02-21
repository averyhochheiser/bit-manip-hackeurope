import { DashboardPreview } from "@/components/marketing/dashboard-preview";
import { Hero } from "@/components/marketing/hero";
import { StorySection } from "@/components/marketing/story-section";
import { WhyDifferent } from "@/components/marketing/why-different";
import { StonewareFooter } from "@/components/ui/stoneware-footer";

export default function MarketingPage() {
  return (
    <main className="min-h-screen">
      {/* 
        The Sandwich Layout Grid Frame
        By floating max-w-7xl with borders against the global substrate, 
        we execute the Bento "Stoneware" aesthetic.
      */}
      <div className="mx-auto flex max-w-[1400px] flex-col border-x-[0.5px] border-border-subtle bg-canvas shadow-2xl">
        <header className="relative z-10 flex items-center justify-between border-b-[0.5px] border-border-subtle bg-canvas px-6 py-8 lg:px-12">
          <p className="text-[10px] uppercase tracking-widest text-ink-muted">
            Carbon Gate
          </p>
          <div className="text-[10px] uppercase tracking-widest text-ink-muted">
            GitHub Action + Stripe Metered Billing
          </div>
        </header>

        <Hero />
        <WhyDifferent />
        <StorySection />
        <DashboardPreview />
        <StonewareFooter />
      </div>
    </main>
  );
}
