"use client";

import { motion } from "framer-motion";
import { useTextScramble } from "@/components/ui/text-scramble";

export function Hero() {
  const preTitle = useTextScramble("physics", "Physics-driven carbon intelligence", {
    startDelay: 400,
    holdMs: 600,
    scrambleMs: 1200
  });

  return (
    <section
      className="relative flex min-h-screen w-full items-center justify-center p-6 lg:p-12 overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url('/design-bg.jpg')" }}
    >
      <div className="absolute inset-0 bg-ink/5" />

      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex w-full max-w-4xl flex-col items-center justify-center text-center gap-8 bg-ink/15 backdrop-blur-[2px] border border-white/40 rounded-[5px] p-16 py-24 lg:p-20 lg:py-32"
      >
        <div className="flex flex-col items-center">
          <div className="mb-6 font-mono text-sm tracking-widest text-canvas/60 uppercase">
            {preTitle}
          </div>

          <h1 className="text-5xl lg:text-7xl font-normal tracking-[-0.04em] text-canvas max-w-3xl">
            The Invisible Footprint.
          </h1>

          <h2 className="mt-6 text-2xl lg:text-3xl font-light text-canvas/70 tracking-tight max-w-2xl mx-auto">
            Sustainability is now a first-class citizen of CI/CD.
          </h2>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-8">
            <button
              onClick={() => {
                window.location.href = "/dashboard";
              }}
              className="text-[10px] uppercase tracking-widest text-canvas underline-offset-4 decoration-[0.5px] hover:underline"
            >
              Go to Dashboard
            </button>
            <a
              href="https://github.com/averyhochheiser/bit-manip-hackeurope"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] uppercase tracking-widest text-canvas/60 underline-offset-4 decoration-[0.5px] hover:underline hover:text-canvas"
            >
              View on GitHub
            </a>
          </div>

        </div>
      </motion.div>
    </section>
  );
}
