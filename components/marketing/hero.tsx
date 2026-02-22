"use client";

import { motion } from "framer-motion";
import { useTextScramble } from "@/components/ui/text-scramble";
import { Zap, ArrowRight, Github } from "lucide-react";

const PUE_EQUATION = "PUE = 1 + Q\u2044W";
const FINAL_HEADLINE = "The Invisible Footprint.";

function AnimatedCounter({
  end,
  suffix = "",
}: {
  end: number;
  suffix?: string;
  duration?: number;
}) {
  return (
    <>
      {end}
      {suffix}
    </>
  );
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
};

export function Hero({ isSignedIn = false }: { isSignedIn?: boolean }) {
  const headline = useTextScramble(PUE_EQUATION, FINAL_HEADLINE, {
    startDelay: 900,
    holdMs: 1600,
    scrambleMs: 1500,
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
          <div className="relative">
            <motion.div
              variants={item}
              className="mb-3 flex items-center justify-center gap-3"
            >
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sage/30 bg-sage/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-sage">
                <Zap size={10} />
                Physics-driven carbon intelligence
              </span>
            </motion.div>

            <div className="flex min-h-[80px] items-center justify-center sm:min-h-[96px] md:min-h-[120px] lg:min-h-[144px]">
              <motion.h1
                variants={item}
                className="font-display text-3xl font-bold leading-[1.05] tracking-tight text-canvas sm:text-4xl md:text-5xl lg:text-6xl"
              >
                {headline}
              </motion.h1>
            </div>

            <motion.p
              variants={item}
              className="mt-4 max-w-xl mx-auto font-serif text-lg leading-relaxed text-canvas/70 sm:text-xl"
            >
              One platform to track, enforce, and reduce your
              organisation&apos;s carbon footprint across every GitHub repo
              and team.
            </motion.p>

            <motion.div
              variants={item}
              className="mt-10 flex flex-wrap items-center justify-center gap-4"
            >
              {isSignedIn ? (
                <a
                  href="/dashboard"
                  className="group inline-flex items-center gap-2.5 rounded-full bg-[#23282E] px-8 py-4 font-semibold text-[#FFF8F0] shadow-lg shadow-[#23282E]/20 transition-all duration-300 hover:scale-[1.03] hover:bg-sage hover:text-white hover:shadow-sage/30"
                >
                  Go to Dashboard
                  <ArrowRight size={18} className="ml-1" />
                </a>
              ) : (
                <a
                  href="/api/auth/signin"
                  className="group inline-flex items-center gap-2.5 rounded-full bg-[#23282E] px-8 py-4 font-semibold text-[#FFF8F0] shadow-lg shadow-[#23282E]/20 transition-all duration-300 hover:scale-[1.03] hover:bg-sage hover:text-white hover:shadow-sage/30"
                >
                  Sign In with GitHub
                  <Github size={18} className="ml-1" />
                </a>
              )}
              <a
                href="https://github.com/averyhochheiser/bit-manip-hackeurope"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/30 px-5 py-3.5 text-sm font-medium text-canvas/60 transition-all hover:border-white/50 hover:text-canvas/90"
              >
                <Github size={16} />
                View on GitHub
              </a>
            </motion.div>

            <motion.div
              variants={item}
              className="mt-10 flex flex-wrap justify-center gap-8 border-t border-white/[0.1] pt-6"
            >
              <div>
                <p className="text-2xl font-bold text-canvas">
                  <AnimatedCounter end={88} suffix="%" />
                </p>
                <p className="mt-0.5 text-xs text-canvas/45">
                  Cleaner with Crusoe
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold text-canvas">
                  <AnimatedCounter end={5} suffix=" min" duration={1.5} />
                </p>
                <p className="mt-0.5 text-xs text-canvas/45">
                  Setup time
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold text-canvas">
                  <AnimatedCounter end={42} suffix="+" duration={1.8} />
                </p>
                <p className="mt-0.5 text-xs text-canvas/45">
                  Gate checks this month
                </p>
              </div>
            </motion.div>

            <motion.div
              variants={item}
              className="mt-6 flex items-center justify-center gap-4"
            >
              <span className="font-monoData text-[11px] text-canvas/20">
                ΔF = α · ln(C / C₀)
              </span>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
