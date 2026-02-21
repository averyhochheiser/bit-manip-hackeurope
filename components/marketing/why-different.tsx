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
    <section className="relative py-24">
      <div className="mb-12">
        <p className="text-[10px] uppercase tracking-widest text-ink-muted">
          Why we are different
        </p>
        <h2 className="mt-4 text-2xl font-normal tracking-tight text-ink">
          Built for enforcement and accountability
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {points.map((point, index) => (
          <motion.article
            key={point.title}
            className="rounded border-[0.5px] border-border-subtle bg-canvas-raised px-8 py-10"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{
              delay: index * 0.08,
              duration: 0.5,
              ease: "easeOut"
            }}
          >
            <h3 className="text-base font-normal text-ink">{point.title}</h3>
            <p className="mt-4 text-sm font-light leading-relaxed text-ink-muted">
              {point.copy}
            </p>
          </motion.article>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-4 text-[10px] uppercase tracking-widest text-ink-faint">
        <span className="rounded border-[0.5px] border-border-subtle px-4 py-2">
          Radiative Forcing Modeled
        </span>
        <span className="rounded border-[0.5px] border-border-subtle px-4 py-2">
          Embodied Carbon Aware
        </span>
        <span className="rounded border-[0.5px] border-border-subtle px-4 py-2">
          Fourier Carbon Forecasting
        </span>
      </div>
    </section>
  );
}
