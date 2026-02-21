"use client";

import { motion } from "framer-motion";
import { LiquidText } from "@/components/ui/liquid-text";

// ... existing points ...
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
    <section className="grid grid-cols-1 border-b-[0.5px] border-border-subtle lg:grid-cols-12">
      {/* Left Text/Image Cell */}
      <div className="relative flex flex-col items-center text-center border-b-[0.5px] border-border-subtle p-6 lg:col-span-5 lg:border-b-0 lg:border-r-[0.5px] lg:p-12">
        <p className="absolute left-0 top-6 w-full text-[10px] uppercase tracking-widest text-ink-muted lg:top-12">
          Why we are different
        </p>

        <div className="mt-24 flex flex-col items-center w-full">
          <h2 className="text-4xl font-normal leading-none tracking-tight text-ink sm:text-5xl">
            <LiquidText text="Built for enforcement and accountability." />
          </h2>

          <div className="mt-16 flex flex-wrap justify-center gap-4 text-[10px] uppercase tracking-widest text-ink-faint">
            <span className="border-[0.5px] border-border-subtle bg-canvas-raised px-4 py-2">
              Radiative Forcing Modeled
            </span>
            <span className="border-[0.5px] border-border-subtle bg-canvas-raised px-4 py-2">
              Embodied Carbon Aware
            </span>
            <span className="border-[0.5px] border-border-subtle bg-canvas-raised px-4 py-2">
              Fourier Carbon Forecasting
            </span>
          </div>
        </div>
      </div>

      {/* Right Grid of Points */}
      <div className="grid grid-cols-1 lg:col-span-7 lg:grid-cols-2">
        {points.map((point, index) => (
          <motion.article
            key={point.title}
            className={`flex flex-col items-center text-center border-b-[0.5px] border-border-subtle bg-canvas p-6 lg:p-12 ${index % 2 === 0 ? "lg:border-r-[0.5px]" : ""
              } ${index === points.length - 1 ? "lg:border-b-0" : ""}`}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{
              delay: index * 0.08,
              duration: 0.5,
              ease: "easeOut"
            }}
          >
            <p className="text-[10px] uppercase tracking-widest text-ink-muted">
              Point {String(index + 1).padStart(2, "0")}
            </p>
            <h3 className="mt-12 text-xl font-normal leading-tight text-ink lg:mt-24">{point.title}</h3>
            <p className="mt-4 text-sm font-light leading-relaxed text-ink-muted">
              {point.copy}
            </p>
          </motion.article>
        ))}
        {/* Placeholder image block to fill the odd grid cell space */}
        {points.length % 2 !== 0 && (
          <div className="relative min-h-[300px] border-b-[0.5px] border-border-subtle bg-border-subtle lg:border-b-0">
            <img
              src="/hero-bg.jpg"
              alt="Data center servers"
              className="absolute inset-0 h-full w-full object-cover object-center grayscale opacity-80 mix-blend-multiply"
            />
          </div>
        )}
      </div>
    </section>
  );
}
