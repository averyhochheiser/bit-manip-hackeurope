import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

const HEADLINES = [
  "Ship green by default: Carbon Gate enforces your CI/CD carbon budget on every PR.",
  "From pass to reroute in one policy: block high-emission builds before they hit prod.",
  "Built for EU CBAM readiness: auditable carbon controls directly in your GitHub pipeline.",
  "The carbon firewall for ML delivery: measure, enforce, and bill overages automatically."
];

export default function MarketingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gate-bg">
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-60" />
      <div className="relative mx-auto flex max-w-7xl flex-col gap-10 px-4 py-16 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.2em] text-white/60">Carbon Gate</p>
          <div className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/75">
            GitHub Action + Stripe Metered Billing
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <article className="panel xl:col-span-8 p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
              <ShieldCheck size={14} />
              CI/CD Enforcement Layer
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight text-white">
              Carbon-aware ML deployment guardrails built for modern engineering teams.
            </h1>
            <p className="mt-4 max-w-3xl text-base text-white/70">
              Carbon Gate evaluates every PR, compares emissions against your org budget, and
              reroutes high-intensity workloads to cleaner compute while maintaining an invoice-grade
              audit trail.
            </p>
            <div className="mt-8 flex gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg border border-crusoe/35 bg-crusoe/20 px-4 py-2 text-sm font-medium text-sky-100 hover:bg-crusoe/35"
              >
                Open Dashboard
                <ArrowRight size={14} />
              </Link>
              <Link
                href="/settings"
                className="inline-flex items-center rounded-lg border border-white/15 bg-white/8 px-4 py-2 text-sm text-white/90 hover:bg-white/15"
              >
                Configure Policy
              </Link>
            </div>
          </article>

          <article className="panel xl:col-span-4 p-6">
            <p className="text-xs uppercase tracking-[0.16em] text-white/60">Pricing</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">$0.85 / kgCO2e over budget</h2>
            <p className="mt-2 text-sm text-white/65">
              Metered in Stripe. Included quota is controlled in policy settings.
            </p>
            <div className="mt-6 space-y-2 text-sm text-white/75">
              <p className="flex justify-between">
                <span>Base plan</span>
                <span className="font-monoData">$49/mo</span>
              </p>
              <p className="flex justify-between">
                <span>Included emissions</span>
                <span className="font-monoData">320kg/mo</span>
              </p>
              <p className="flex justify-between">
                <span>Overage</span>
                <span className="font-monoData">$0.85/kg</span>
              </p>
            </div>
          </article>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {HEADLINES.map((headline) => (
            <article key={headline} className="panel-muted p-4 text-sm text-white/85">
              {headline}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
