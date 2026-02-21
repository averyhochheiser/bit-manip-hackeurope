"use client";

import { motion } from "framer-motion";
import { LiquidText } from "@/components/ui/liquid-text";
import { TextScramble } from "@/components/ui/text-scramble";

export function StorySection() {
  return (
    <section className="flex flex-col bg-canvas pb-48">
      {/* Chapter 1: The Invisible Footprint (Inverted) */}
      <div className="w-full flex justify-center py-32 px-6 bg-ink text-canvas">
        <div className="max-w-4xl w-full flex flex-col items-center text-center">
          <p className="font-mono text-xs tracking-widest text-canvas/50 uppercase mb-8">
            <TextScramble initial="01 / init_sequence" target="01 / The Invisible Footprint" holdMs={600} scrambleMs={1200} />
          </p>
          <h2 className="text-4xl lg:text-7xl font-normal leading-[1.05] tracking-tight text-canvas">
            <LiquidText text="Every training run leaves a trace." />
          </h2>
          <p className="mt-12 text-lg lg:text-xl font-light leading-relaxed text-canvas/70 max-w-2xl">
            GPU hours become kilowatt-hours become kilograms of CO&#x2082;. Most
            teams never see it.
          </p>
        </div>
      </div>

      {/* Massive Editorial Image removed to become Hero background */}
      <div className="w-full flex justify-center py-32 px-6">
        <div className="max-w-6xl w-full flex flex-col items-center">
          <p className="font-mono text-xs tracking-widest text-ink/50 uppercase mb-12">
            <TextScramble initial="02 / sys_analysis" target="02 / Physics Focus" holdMs={600} scrambleMs={1200} />
          </p>
          <h2 className="max-w-5xl text-4xl lg:text-6xl font-normal text-center leading-[1.05] tracking-tight text-ink">
            <LiquidText text="Standard models guess. We calculate." />
          </h2>

          <div className="mt-32 grid w-full grid-cols-1 md:grid-cols-3 gap-16 lg:gap-24">
            <div className="flex flex-col">
              <span className="h-[1px] w-full bg-ink/20 mb-8"></span>
              <p className="text-xs tracking-widest text-ink/50 uppercase mb-6">
                <LiquidText text="Dynamic PUE" />
              </p>
              <p className="font-mono text-xl lg:text-2xl font-light text-ink mb-6">1 + Q<sub>c</sub> / P<sub>it</sub></p>
              <p className="text-base font-light leading-relaxed text-ink/70">Efficiency that breathes with the ambient air precisely.</p>
            </div>
            <div className="flex flex-col">
              <span className="h-[1px] w-full bg-ink/20 mb-8"></span>
              <p className="text-xs tracking-widest text-ink/50 uppercase mb-6">
                <LiquidText text="Fourier CI" />
              </p>
              <p className="font-mono text-xl lg:text-2xl font-light text-ink mb-6">CI(t) = &Sigma; a&#x2099; cos(n&omega;t)</p>
              <p className="text-base font-light leading-relaxed text-ink/70">Grid carbon oscillates. We model the deep harmonics.</p>
            </div>
            <div className="flex flex-col">
              <span className="h-[1px] w-full bg-ink/20 mb-8"></span>
              <p className="text-xs tracking-widest text-ink/50 uppercase mb-6">
                <LiquidText text="Radiative Forcing" />
              </p>
              <p className="font-mono text-xl lg:text-2xl font-light text-ink mb-6">&Delta;F = &alpha; &middot; ln(C/C&#x2080;)</p>
              <p className="text-base font-light leading-relaxed text-ink/70">Calculated energy shift of the atmosphere&apos;s balance.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chapter 3 & 4 */}
      <div className="w-full mt-16 bg-stoneware-green text-white">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-32 py-32 px-6 lg:px-12">

          <div className="flex-1 flex flex-col">
            <p className="font-mono text-xs tracking-widest text-white/50 uppercase mb-8">
              <TextScramble initial="03 / optimization" target="03 / The Solution" holdMs={600} scrambleMs={1200} />
            </p>
            <h2 className="text-4xl lg:text-5xl font-normal leading-[1.1] tracking-tight text-white mb-8">
              <LiquidText text="Harnessing wasted energy for clean compute." />
            </h2>
            <p className="text-lg font-light leading-relaxed text-white/70 max-w-lg">
              Crusoe repurposes stranded gas into GPU cycles. Carbon Gate routes your
              dirtiest workloads there automatically, cutting emissions up to 88%.
            </p>
          </div>

          <div className="flex-1 flex flex-col items-start lg:items-end text-left lg:text-right mt-16 lg:mt-0">
            <p className="font-mono text-xs tracking-widest text-canvas uppercase mb-8">
              <TextScramble initial="04 / execution" target="04 / The Gate" holdMs={600} scrambleMs={1200} />
            </p>
            <h2 className="text-4xl lg:text-5xl font-normal leading-[1.1] tracking-tight text-white mb-8">
              <LiquidText text="Policy enforced on every PR." />
            </h2>
            <p className="text-lg font-light leading-relaxed text-white/70 max-w-lg mb-12">
              Pass, warn, or reroute. The live dashboard below is not a mockup.
            </p>

            <span className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm px-6 py-3 text-xs uppercase tracking-widest text-white border-[1px] border-white/20">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              Gate active
            </span>
          </div>

        </div>
      </div>
    </section>
  );
}
