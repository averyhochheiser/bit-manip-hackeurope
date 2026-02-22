import { DashboardPreview } from "@/components/marketing/dashboard-preview";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { StorySection } from "@/components/marketing/story-section";
import { WhyDifferent } from "@/components/marketing/why-different";
import { Footer } from "@/components/marketing/footer";
import { CustomCursor } from "@/components/ui/inverted-cursor";

export default function MarketingPage() {
  return (
    <main className="relative min-h-screen bg-[#23282E] overflow-x-hidden">
      <CustomCursor size="h-[84px] w-[84px]" />
      <Hero />

      <WhyDifferent />

      <HowItWorks />
      <StorySection />
      <DashboardPreview />
      <Footer />
    </main>
  );
}
