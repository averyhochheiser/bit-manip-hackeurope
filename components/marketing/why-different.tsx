"use client";

import { motion } from "framer-motion";
import { LiquidText } from "@/components/ui/liquid-text";

// ... existing points ...
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
    <section className="w-full py-32 lg:py-48 px-6 lg:px-12 bg-stoneware-green">
      <div className="mx-auto max-w-7xl">

        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-32">
          <div className="max-w-3xl">
            <p className="font-mono text-xs tracking-widest text-white/50 uppercase mb-8">
              Why we are different
            </p>
            <h2 className="text-4xl font-normal leading-tight tracking-[-0.02em] text-white sm:text-6xl">
              Built for enforcement and accountability.
            </h2>
          </div>

          <div className="mt-12 lg:mt-0 flex flex-col gap-4 text-xs uppercase tracking-widest text-white/70">
            <span className="flex items-center gap-4"><span className="w-8 h-[1px] bg-white/20"></span>Radiative Forcing Modeled</span>
            <span className="flex items-center gap-4"><span className="w-8 h-[1px] bg-white/20"></span>Embodied Carbon Aware</span>
            <span className="flex items-center gap-4"><span className="w-8 h-[1px] bg-white/20"></span>Fourier Carbon Forecasting</span>
          </div>
        </div>

        {/* Aligned Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-y-16 gap-x-12">
          {points.map((point, index) => (
            <motion.article
              key={point.title}
              className="flex flex-col col-span-1"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{
                delay: index * 0.1,
                duration: 0.8,
                ease: [0.16, 1, 0.3, 1]
              }}
            >
              <div className="flex items-center gap-4 mb-6">
                <span className="font-mono text-xs tracking-widest text-white/40">0{index + 1} / 0{points.length}</span>
                <div className="h-[1px] flex-1 bg-white/10"></div>
              </div>
              <h3 className="text-xl font-medium leading-snug tracking-tight text-white mb-4">{point.title}</h3>
              <p className="text-sm font-light leading-relaxed text-white/70">
                {point.copy}
              </p>
            </motion.article>
          ))}

        </div>

      </div >
    </section >
  );
}
