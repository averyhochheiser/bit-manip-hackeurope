"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, MessageCircle } from "lucide-react";

/* ── Scramble animation ───────────────────────────────────────────── */

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

/* ── Framer variants ──────────────────────────────────────────────── */

const cardVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.85,
      ease: [0.22, 1, 0.36, 1] as const,
      staggerChildren: 0.14,
      delayChildren: 0.3
    }
  }
};

const child = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" as const }
  }
};

/* ── Component ────────────────────────────────────────────────────── */

export function Hero() {
  const headline = useTextScramble(PUE_EQUATION, FINAL_HEADLINE, {
    startDelay: 900,
    holdMs: 1600,
    scrambleMs: 1500
  });

  return (
    <section className="relative h-screen w-full overflow-hidden">
      {/* Background image */}
      <img
        src="/design-bg.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#23282E]/20 via-transparent to-[#23282E]/55" />

      {/* Floating card — absolute centered */}
      <div className="absolute left-1/2 top-1/2 w-[90%] max-w-5xl -translate-x-1/2 -translate-y-1/2">
        <motion.div
          className="flex flex-col justify-between rounded-3xl bg-[#FFF8F0] p-8 text-[#23282E] shadow-[0_20px_50px_rgba(0,0,0,0.3)] md:aspect-[16/10] md:p-12"
          variants={cardVariants}
          initial="hidden"
          animate="visible"
        >
          {/* ── Top: Typography ── */}
          <div>
            <motion.p
              variants={child}
              className="mb-5 text-[10px] font-medium uppercase tracking-[0.25em] text-[#69995D]"
            >
              Physics-driven carbon intelligence
            </motion.p>

            {/* Typography 1 — Scramble headline */}
            <motion.h1
              variants={child}
              className="font-display text-3xl font-bold leading-[1.08] tracking-tight text-[#23282E] sm:text-4xl md:text-5xl lg:text-6xl"
            >
              {headline}
            </motion.h1>

            {/* Typography 2 — Serif sub-headline */}
            <motion.p
              variants={child}
              className="mt-5 max-w-lg font-serif text-base leading-relaxed text-[#23282E]/60 sm:text-lg md:text-xl"
            >
              One platform to track, enforce, and reduce your organisation&apos;s carbon footprint across every GitHub repo and team.
            </motion.p>
          </div>

          {/* ── Bottom: Button + Metadata ── */}
          <div>
            {/* Action row — button & chat icon pinned right */}
            <motion.div
              variants={child}
              className="mb-5 flex items-center justify-end gap-3"
            >
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2.5 rounded-full bg-[#23282E] px-8 py-4 font-medium text-[#FFF8F0] transition-all hover:scale-105 hover:bg-[#98D2EB] hover:text-[#23282E]"
              >
                Open Dashboard
                <ArrowRight size={16} />
              </Link>
              <button
                className="flex h-12 w-12 items-center justify-center rounded-full border border-[#23282E]/10 text-[#23282E]/45 transition hover:bg-[#23282E]/[0.04] hover:text-[#23282E]/70"
                aria-label="Open chat"
              >
                <MessageCircle size={18} />
              </button>
            </motion.div>

            {/* Physics metadata footer */}
            <motion.div
              variants={child}
              className="border-t border-[#23282E]/8 pt-3"
            >
              <span className="font-monoData text-[11px] text-[#23282E]/28">
                ΔF = α · ln(C / C₀)
              </span>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
