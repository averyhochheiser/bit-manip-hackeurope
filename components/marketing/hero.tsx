"use client";

import { motion } from "framer-motion";
import { useTextScramble } from "@/components/ui/text-scramble";
import { CursorTilt } from "@/components/ui/cursor-tilt";
import { ArrowRight, Github, Trophy } from "lucide-react";

const PUE_EQUATION = "PUE = 1 + Q\u2044W";
const FINAL_HEADLINE = "Carbon Gate";

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

export function Hero({ isSignedIn = false }: { isSignedIn?: boolean }) {
  const headline = useTextScramble(PUE_EQUATION, FINAL_HEADLINE, {
    startDelay: 900,
    holdMs: 1600,
    scrambleMs: 1500,
  });

  return (
    <section
      className="relative flex min-h-[85vh] w-full items-center justify-center overflow-hidden bg-cover bg-center p-6 lg:p-12"
      style={{ backgroundImage: "url('/design-bg.jpg')" }}
    >
      <div className="absolute inset-0 bg-ink/5" />

      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex w-full max-w-4xl flex-col items-center justify-center text-center gap-6 bg-ink/15 backdrop-blur-[2px] border border-white/40 rounded-[5px] p-12 py-16 lg:p-16 lg:py-20"
      >
        <div className="flex flex-col items-center">
          <div className="relative w-full">
            <div className="flex min-h-[64px] items-center justify-center sm:min-h-[80px] md:min-h-[96px]">
              <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-canvas sm:text-5xl md:text-6xl">
                {headline}
              </h1>
            </div>

            <p className="mx-auto mt-4 max-w-xl font-serif text-base leading-relaxed text-canvas/70 sm:text-lg">
              One platform to track, enforce, and reduce your
              organisation&apos;s carbon footprint across every GitHub repo
              and team.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {isSignedIn ? (
                <a
                  href="/dashboard"
                  className="group inline-flex items-center gap-2.5 rounded-full bg-[#23282E] px-7 py-3.5 text-sm font-semibold text-[#FFF8F0] shadow-lg shadow-[#23282E]/20 transition-all duration-300 hover:scale-[1.03] hover:shadow-stoneware-green/20"
                >
                  Go to Dashboard
                  <ArrowRight size={16} className="ml-1" />
                </a>
              ) : (
                <a
                  href="/api/auth/signin"
                  className="group inline-flex items-center gap-2.5 rounded-full bg-[#23282E] px-7 py-3.5 text-sm font-semibold text-[#FFF8F0] shadow-lg shadow-[#23282E]/20 transition-all duration-300 hover:scale-[1.03] hover:shadow-stoneware-green/20"
                >
                  Sign In with GitHub
                  <Github size={16} className="ml-1" />
                </a>
              )}
              <a
                href="https://github.com/averyhochheiser/bit-manip-hackeurope"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/30 px-5 py-3 text-sm font-medium text-canvas/60 transition-all hover:border-white/50 hover:text-canvas/90"
              >
                <Github size={15} />
                View on GitHub
              </a>
              <a
                href="/leaderboard"
                className="inline-flex items-center gap-2 rounded-full border border-white/30 px-5 py-3 text-sm font-medium text-canvas/60 transition-all hover:border-white/50 hover:text-canvas/90"
              >
                <Trophy size={15} />
                Leaderboard
              </a>
            </div>

            {/* Stat blocks */}
            <div className="mt-8 grid w-full grid-cols-3 gap-[0.5px] bg-canvas/[0.08]">
              <CursorTilt intensity={5}>
                <div className="relative flex flex-col justify-end bg-ink/60 p-5 backdrop-blur-sm" style={{ minHeight: "100px" }}>
                  <p className="absolute left-5 top-4 text-[10px] uppercase tracking-widest text-canvas/40">
                    Cleaner with Crusoe
                  </p>
                  <p className="font-mono text-2xl font-light text-stoneware-turquoise">
                    <AnimatedCounter end={88} suffix="%" />
                  </p>
                </div>
              </CursorTilt>
              <CursorTilt intensity={5}>
                <div className="relative flex flex-col justify-end bg-ink/60 p-5 backdrop-blur-sm" style={{ minHeight: "100px" }}>
                  <p className="absolute left-5 top-4 text-[10px] uppercase tracking-widest text-canvas/40">
                    Setup time
                  </p>
                  <p className="font-mono text-2xl font-light text-stoneware-green">
                    <AnimatedCounter end={5} suffix=" min" duration={1.5} />
                  </p>
                </div>
              </CursorTilt>
              <CursorTilt intensity={5}>
                <div className="relative flex flex-col justify-end bg-ink/60 p-5 backdrop-blur-sm" style={{ minHeight: "100px" }}>
                  <p className="absolute left-5 top-4 text-[10px] uppercase tracking-widest text-canvas/40">
                    Gate checks
                  </p>
                  <p className="font-mono text-2xl font-light text-stoneware-pink">
                    <AnimatedCounter end={42} suffix="+" duration={1.8} />
                  </p>
                </div>
              </CursorTilt>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
