"use client";

import { motion } from "framer-motion";

const points = [
  {
    title: "CI/CD Enforcement, not dashboard theater",
    copy: "Every PR is evaluated against budget policy and automatically routed by outcome: pass, warn, or reroute."
  },
  {
    title: "Overage billing tied to measured emissions",
    copy: "Stripe metered billing maps directly to budget overrun in kgCO2e so finance and engineering share one source of truth."
  },
  {
    title: "Thermodynamic Advantage",
    copy: "Dynamic PUE modeling adapts to runtime conditions instead of flat assumptions, producing audit-grade carbon estimates."
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
          Radiative Forcing Modeled
        </span>
        <span className="rounded-full border border-floral/10 bg-floral/[0.02] px-3 py-1">
          Embodied Carbon Aware
        </span>
        <span className="rounded-full border border-floral/10 bg-floral/[0.02] px-3 py-1">
          Fourier Carbon Forecasting
        </span>
      </div>
    </section>
  );
}
