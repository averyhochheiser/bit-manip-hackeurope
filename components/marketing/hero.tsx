"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";

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
    <section className="relative flex min-h-screen items-center justify-center bg-canvas px-6">
      <motion.div
        className="mx-auto flex max-w-3xl flex-col items-center text-center"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.p
          variants={child}
          className="text-[10px] uppercase tracking-widest text-stoneware-green"
        >
          Physics-driven carbon intelligence
        </motion.p>

        <motion.h1
          variants={child}
          className="mt-8 text-4xl font-normal leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-6xl"
        >
          {headline}
        </motion.h1>

        <motion.p
          variants={child}
          className="mt-8 max-w-lg text-base font-light leading-relaxed text-ink-muted"
        >
          Sustainability is now a first-class citizen of CI/CD.
        </motion.p>

        <motion.div variants={child} className="mt-12 flex items-center gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2.5 rounded bg-ink px-8 py-4 text-[10px] uppercase tracking-widest text-canvas transition-opacity hover:opacity-80"
          >
            Open Dashboard
            <ArrowRight size={14} strokeWidth={1} />
          </Link>
        </motion.div>

        <motion.p
          variants={child}
          className="mt-16 font-mono text-[10px] text-ink-faint"
        >
          ΔF = α · ln(C / C₀)
        </motion.p>
      </motion.div>
    </section>
  );
}
