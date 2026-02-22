"use client";

import { motion } from "framer-motion";

const points = [
  {
    title: "One hub for every repo and team",
    copy: "Connect all your organisation's GitHub repos. Set individual budgets per repository, per team, or per employee — enforced automatically on every PR."
  },
  {
    title: "Accountability from code to invoice",
    copy: "Stripe metered billing maps directly to budget overrun in kgCO₂e so finance and engineering share one source of truth across every connected project."
  },
  {
    title: "Physics-grade estimates, not guesses",
    copy: "Dynamic PUE modeling, GPU thermal throttling, and Fourier grid forecasting give you audit-ready numbers — not marketing-grade assumptions."
  }
];

export function WhyDifferent() {
  return (
    <section className="relative py-16 sm:py-20">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-floral/55">Why we are different</p>
        <h2 className="mt-3 font-display text-3xl font-bold text-floral sm:text-4xl">
          Built for enforcement and accountability
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {points.map((point, index) => (
          <motion.article
            key={point.title}
            className="panel p-5"
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ delay: index * 0.08, duration: 0.45, ease: "easeOut" }}
          >
            <h3 className="text-lg font-semibold text-floral">{point.title}</h3>
            <p className="mt-3 text-sm text-floral/70">{point.copy}</p>
          </motion.article>
        ))}
      </div>

      <div className="mt-7 flex flex-wrap gap-3 text-xs uppercase tracking-[0.14em] text-floral/45">
        <span className="rounded-full border border-floral/10 bg-floral/[0.02] px-3 py-1">
          Per-repo budgets
        </span>
        <span className="rounded-full border border-floral/10 bg-floral/[0.02] px-3 py-1">
          Team &amp; employee thresholds
        </span>
        <span className="rounded-full border border-floral/10 bg-floral/[0.02] px-3 py-1">
          EU CBAM aligned reporting
        </span>
        <span className="rounded-full border border-floral/10 bg-floral/[0.02] px-3 py-1">
          Fourier carbon forecasting
        </span>
      </div>
    </section>
  );
}
