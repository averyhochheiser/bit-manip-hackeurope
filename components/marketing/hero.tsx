"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { LiquidText } from "@/components/ui/liquid-text";
import { ElasticButton } from "@/components/ui/elastic-button";

const GLYPHS = "αβγδεζθλμπσφψ∑∏∫∂√∞≈≠±×÷∆01{}[]<>~#";
const PUE_EQUATION = "PUE(t) = 1 + (Q_cooling / P_IT)";
const FINAL_HEADLINE = "The Invisible Footprint.";

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function useTextScramble(
  initial: string,
  target: string,
  opts: { holdMs?: number; scrambleMs?: number; startDelay?: number } = {}
) {
  const { holdMs = 1400, scrambleMs = 1500, startDelay = 800 } = opts;
  const [text, setText] = useState(initial);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      const t = setTimeout(() => setText(target), startDelay + holdMs);
      return () => clearTimeout(t);
    }

    let cancelled = false;

    (async () => {
      await sleep(startDelay);
      if (cancelled) return;

      setText(initial);
      await sleep(holdMs);
      if (cancelled) return;

      const frameDur = 26;
      const frames = Math.ceil(scrambleMs / frameDur);
      const maxLen = Math.max(initial.length, target.length);

      for (let f = 0; f <= frames; f++) {
        if (cancelled) return;
        const progress = f / frames;
        const currentLen = Math.round(
          initial.length + (target.length - initial.length) * progress
        );

        let out = "";
        for (let i = 0; i < currentLen; i++) {
          const resolveAt = 0.25 + (i / maxLen) * 0.7;
          if (progress >= resolveAt && i < target.length) {
            out += target[i];
          } else {
            out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          }
        }
        setText(out);
        await sleep(frameDur);
      }
      setText(target);
    })();

    return () => {
      cancelled = true;
    };
  }, [initial, target, holdMs, scrambleMs, startDelay, reduced]);

  return text;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.8,
      ease: [0.22, 1, 0.36, 1] as const,
      staggerChildren: 0.12,
      delayChildren: 0.2
    }
  }
};

const child = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" as const }
  }
};

export function Hero() {
  const headline = useTextScramble(PUE_EQUATION, FINAL_HEADLINE, {
    startDelay: 900,
    holdMs: 1600,
    scrambleMs: 1500
  });

  return (
    <section className="col-span-1 grid min-h-[80vh] grid-cols-1 border-b-[0.5px] border-border-subtle lg:grid-cols-2">
      {/* Primary Headline Grid Cell */}
      <div className="relative flex flex-col items-center justify-end text-center border-b-[0.5px] border-border-subtle p-6 lg:border-b-0 lg:border-r-[0.5px] lg:p-12">
        <p className="absolute left-0 top-6 w-full lg:top-12 text-[10px] uppercase tracking-widest text-stoneware-green">
          Physics-driven carbon intelligence
        </p>
        <motion.h1
          variants={child}
          initial="hidden"
          animate="visible"
          className="max-w-xl text-5xl font-normal leading-[0.95] tracking-tight text-ink lg:text-7xl"
        >
          <LiquidText text={headline} />
        </motion.h1>
      </div>

      {/* Auxiliary Info Grid Cell */}
      <div className="relative flex flex-col items-center justify-between text-center bg-canvas p-6 lg:bg-transparent lg:p-12">
        <motion.p
          variants={child}
          initial="hidden"
          animate="visible"
          className="max-w-sm mx-auto text-lg font-light leading-snug text-ink-muted"
        >
          Sustainability is now a first-class citizen of CI/CD.
        </motion.p>

        <div className="mt-16 flex flex-col items-center gap-12 lg:mt-auto">
          <motion.div variants={child} initial="hidden" animate="visible">
            <Link href="/dashboard">
              <ElasticButton className="inline-flex items-center gap-2.5 rounded-none border-[0.5px] border-ink bg-transparent px-8 py-4 text-[10px] uppercase tracking-widest text-ink transition-colors hover:bg-ink hover:text-canvas">
                Open Dashboard
                <ArrowRight size={14} strokeWidth={1} />
              </ElasticButton>
            </Link>
          </motion.div>

          <motion.p
            variants={child}
            initial="hidden"
            animate="visible"
            className="font-mono text-[10px] tracking-widest text-ink-faint"
          >
            ΔF = α · ln(C / C₀)
          </motion.p>
        </div>
      </div>
    </section>
  );
}
