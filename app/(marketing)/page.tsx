import Link from "next/link";
import { DashboardPreview } from "@/components/marketing/dashboard-preview";
import { Hero } from "@/components/marketing/hero";
import { StorySection } from "@/components/marketing/story-section";
import { WhyDifferent } from "@/components/marketing/why-different";
import { StonewareFooter } from "@/components/ui/stoneware-footer";
import { CustomCursor } from "@/components/ui/inverted-cursor";

export default function MarketingPage() {
  return (
    <main className="min-h-screen">
      <CustomCursor size="w-16 h-16 md:w-24 md:h-24" />
      <header className="absolute left-0 top-0 z-50 flex w-full items-center justify-between px-6 py-8 lg:px-12">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-[10px] font-bold uppercase tracking-widest text-ink hover:text-ink/70 transition-colors">
            Carbon Gate
          </Link>
          <div className="hidden md:block text-[10px] uppercase tracking-widest text-ink/50">
            GitHub Action + Stripe Metered Billing
          </div>
        </div>
        <nav className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="text-[10px] font-medium uppercase tracking-widest text-ink border-b-[1px] border-ink pb-1 hover:text-ink/70 hover:border-ink/70 transition-colors"
          >
            Enter Dashboard
          </Link>
        </nav>
      </header>

      <div className="flex flex-col">
        <Hero />

        {/* Continuing the style with a solid green block below Hero */}
        <div className="bg-[#69995D] text-white">
          <WhyDifferent />
        </div>

        <StorySection />
        <DashboardPreview />
        <StonewareFooter />
      </div>
    </main>
  );
}
