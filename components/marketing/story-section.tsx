"use client";

import { motion } from "framer-motion";
import { LiquidText } from "@/components/ui/liquid-text";

export function StorySection() {
  return (
    <section className="flex flex-col border-b-[0.5px] border-border-subtle">
      {/* Chapter 1 */}
      <div className="grid grid-cols-1 border-b-[0.5px] border-border-subtle lg:grid-cols-2">
        <div className="relative min-h-[400px] border-b-[0.5px] border-border-subtle bg-border-subtle lg:border-b-0 lg:border-r-[0.5px]">
          <img
            src="/design-bg.jpg"
            alt="Abstract smoke"
            className="absolute inset-0 h-full w-full object-cover object-center grayscale opacity-80 mix-blend-multiply"
          />
        </div>
        <div className="relative flex flex-col items-center justify-center text-center p-6 lg:p-12">
          <p className="absolute left-0 top-6 w-full text-[10px] uppercase tracking-widest text-stoneware-pink lg:top-12">
            The invisible footprint
          </p>
          <div className="mt-20 lg:mt-0 flex flex-col items-center">
            <h2 className="text-4xl font-normal leading-[1.1] tracking-tight text-ink sm:text-5xl">
              <LiquidText text="Every training run leaves a trace." />
            </h2>
            <p className="mt-8 text-base font-light text-ink-muted">
              GPU hours become kilowatt-hours become kilograms of CO&#x2082;. Most
              teams never see it.
            </p>
          </div>
        </div>
      </div>

      {/* Chapter 2: Physics over guesswork */}
      <div className="relative flex flex-col items-center text-center border-b-[0.5px] border-border-subtle p-6 lg:p-12">
        <p className="absolute left-0 top-6 w-full text-[10px] uppercase tracking-widest text-stoneware-turquoise lg:top-12">
          Physics over guesswork
        </p>
        <div className="mt-20 flex flex-col items-center w-full">
          <h2 className="max-w-4xl text-4xl font-normal leading-[1.1] tracking-tight text-ink sm:text-5xl">
            <LiquidText text="Standard models guess. We calculate." />
          </h2>
          <div className="mt-16 grid w-full grid-cols-1 lg:grid-cols-3 border-t-[0.5px] border-border-subtle">
            <div className="relative flex flex-col items-center border-b-[0.5px] border-border-subtle p-6 lg:border-b-0 lg:border-r-[0.5px] lg:p-10 text-center">
              <p className="text-[10px] uppercase tracking-widest text-ink-muted">Dynamic PUE</p>
              <p className="mt-6 font-mono text-xl font-light text-ink">1 + Q<sub>cooling</sub> / P<sub>IT</sub></p>
              <p className="mt-6 text-sm font-light text-ink-muted">Efficiency that breathes with the ambient air.</p>
            </div>
            <div className="relative flex flex-col items-center border-b-[0.5px] border-border-subtle p-6 lg:border-b-0 lg:border-r-[0.5px] lg:p-10 text-center">
              <p className="text-[10px] uppercase tracking-widest text-ink-muted">Fourier Carbon Intensity</p>
              <p className="mt-6 font-mono text-xl font-light text-ink">CI(t) = &Sigma; a&#x2099; cos(n&omega;t + &phi;&#x2099;)</p>
              <p className="mt-6 text-sm font-light text-ink-muted">Grid carbon oscillates. We model the harmonics.</p>
            </div>
            <div className="relative flex flex-col items-center p-6 lg:p-10 text-center">
              <p className="text-[10px] uppercase tracking-widest text-ink-muted">Radiative Forcing</p>
              <p className="mt-6 font-mono text-xl font-light text-ink">&Delta;F = &alpha; &middot; ln(C / C&#x2080;)</p>
              <p className="mt-6 text-sm font-light text-ink-muted">Your emissions shift the atmosphere&apos;s energy balance.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chapter 3 & 4 Grid Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2">
        <div className="relative flex flex-col items-center justify-between text-center border-b-[0.5px] border-border-subtle p-6 lg:border-b-0 lg:border-r-[0.5px] lg:p-12">
          <p className="absolute left-0 top-6 w-full text-[10px] uppercase tracking-widest text-ink-muted lg:top-12">
            The solution
          </p>
          <div className="mt-24 flex flex-col items-center">
            <h2 className="text-4xl font-normal leading-[1.1] tracking-tight text-ink sm:text-5xl">
              <LiquidText text="Harnessing wasted energy for clean compute." />
            </h2>
            <p className="mt-8 mx-auto max-w-sm text-base font-light text-ink-muted">
              Crusoe repurposes stranded gas into GPU cycles. Carbon Gate routes your
              dirtiest workloads there automatically, cutting emissions up to 88%.
            </p>
          </div>
        </div>

        <div className="relative flex flex-col items-center justify-between text-center bg-canvas-raised p-6 lg:p-12">
          <p className="absolute left-0 top-6 w-full text-[10px] uppercase tracking-widest text-stoneware-green lg:top-12">
            The gate
          </p>
          <div className="mt-24 flex flex-col items-center">
            <h2 className="text-4xl font-normal leading-[1.1] tracking-tight text-ink sm:text-5xl">
              <LiquidText text="Policy enforced on every PR." />
            </h2>
            <p className="mt-8 text-base font-light text-ink-muted">
              Pass, warn, or reroute. The dashboard below is not a mockup.
            </p>
            <div className="mt-16">
              <span className="inline-flex items-center gap-2.5 bg-canvas px-5 py-2 text-[10px] uppercase tracking-widest text-stoneware-green border-[0.5px] border-stoneware-green border-opacity-30">
                <span className="h-1.5 w-1.5 rounded-full bg-stoneware-green" />
                Gate active
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
