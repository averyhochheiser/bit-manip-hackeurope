"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Github, Zap, Shield, BarChart3 } from "lucide-react";

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

/* ── Animated particles ───────────────────────────────────────────── */

function FloatingParticles() {
  const particles = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3 + 1,
        duration: Math.random() * 15 + 10,
        delay: Math.random() * 5,
        opacity: Math.random() * 0.4 + 0.1,
      })),
    []
  );

  return (
    <div className="absolute inset-0 overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-crusoe"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `${p.y}%`,
            opacity: p.opacity,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [p.opacity, p.opacity * 1.5, p.opacity],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/* ── Live counter ─────────────────────────────────────────────────── */

function AnimatedCounter({
  end,
  suffix,
  duration = 2,
}: {
  end: number;
  suffix: string;
  duration?: number;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let frame: number;
    const startTime = Date.now();

    function animate() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(end * eased));
      if (progress < 1) frame = requestAnimationFrame(animate);
    }

    const timer = setTimeout(() => {
      frame = requestAnimationFrame(animate);
    }, 2200);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [end, duration]);

  return (
    <span className="font-monoData">
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

/* ── Framer variants ──────────────────────────────────────────────── */

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.4,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as any },
  },
};

/* ── Component ────────────────────────────────────────────────────── */

export function Hero() {
  const headline = useTextScramble(PUE_EQUATION, FINAL_HEADLINE, {
    startDelay: 900,
    holdMs: 1600,
    scrambleMs: 1500,
  });

  return (
    <section className="relative min-h-screen w-full overflow-hidden">
      {/* Background image */}
      <img
        src="/design-bg.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Multi-layer gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#23282E]/30 via-transparent to-[#23282E]" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#23282E]/40 via-transparent to-[#23282E]/20" />

      {/* Glowing orb */}
      <div className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-crusoe/[0.07] blur-[120px]" />

      {/* Particles */}
      <FloatingParticles />

      {/* Content */}
      <div className="relative flex min-h-screen flex-col pt-24">
        {/* Main hero content — centered */}
        <div className="flex flex-1 items-center justify-center px-4 sm:px-6 lg:px-8">
          <motion.div
            className="w-full max-w-5xl"
            variants={container}
            initial="hidden"
            animate="visible"
          >
            {/* Glass card */}
            <motion.div
              variants={item}
              className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#FFF8F0]/[0.97] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,248,240,0.1)] backdrop-blur-xl md:p-12 lg:p-16"
            >
              {/* Subtle inner glow */}
              <div className="pointer-events-none absolute -right-32 -top-32 h-64 w-64 rounded-full bg-crusoe/[0.06] blur-[80px]" />
              <div className="pointer-events-none absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-sage/[0.08] blur-[60px]" />

              <div className="relative">
                {/* Eyebrow */}
                <motion.div
                  variants={item}
                  className="mb-3 flex items-center gap-3"
                >
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-sage/30 bg-sage/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-sage">
                    <Zap size={10} />
                    Physics-driven carbon intelligence
                  </span>
                </motion.div>

                {/* Headline Container — stable height to prevent layout jumps during scramble */}
                <div className="flex min-h-[80px] items-center sm:min-h-[96px] md:min-h-[120px] lg:min-h-[144px]">
                  <motion.h1
                    variants={item}
                    className="font-display text-3xl font-bold leading-[1.05] tracking-tight text-[#23282E] sm:text-4xl md:text-5xl lg:text-6xl"
                  >
                    {headline}
                  </motion.h1>
                </div>

                {/* Subheading */}
                <motion.p
                  variants={item}
                  className="mt-4 max-w-xl font-serif text-lg leading-relaxed text-[#23282E]/55 sm:text-xl"
                >
                  One platform to track, enforce, and reduce your
                  organisation&apos;s carbon footprint across every GitHub repo
                  and team.
                </motion.p>

                {/* CTA row */}
                <motion.div
                  variants={item}
                  className="mt-10 flex flex-wrap items-center gap-4"
                >
                  <button
                    onClick={() => {
                      window.location.href = "/dashboard";
                    }}
                    className="group inline-flex items-center gap-2.5 rounded-full bg-[#23282E] px-8 py-4 font-semibold text-[#FFF8F0] shadow-lg shadow-[#23282E]/20 transition-all duration-300 hover:scale-[1.03] hover:bg-sage hover:text-white hover:shadow-sage/30"
                  >
                    Sign In with GitHub
                    <Github
                      size={18}
                      className="ml-1"
                    />
                  </button>
                  <a
                    href="https://github.com/averyhochheiser/bit-manip-hackeurope"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-[#23282E]/10 px-5 py-3.5 text-sm font-medium text-[#23282E]/60 transition-all hover:border-[#23282E]/25 hover:text-[#23282E]/90"
                  >
                    <Github size={16} />
                    View on GitHub
                  </a>
                </motion.div>

                {/* Stats row */}
                <motion.div
                  variants={item}
                  className="mt-10 flex flex-wrap gap-8 border-t border-[#23282E]/[0.06] pt-6"
                >
                  <div>
                    <p className="text-2xl font-bold text-[#23282E]">
                      <AnimatedCounter end={88} suffix="%" />
                    </p>
                    <p className="mt-0.5 text-xs text-[#23282E]/45">
                      Cleaner with Crusoe
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#23282E]">
                      <AnimatedCounter end={5} suffix=" min" duration={1.5} />
                    </p>
                    <p className="mt-0.5 text-xs text-[#23282E]/45">
                      Setup time
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#23282E]">
                      <AnimatedCounter end={42} suffix="+" duration={1.8} />
                    </p>
                    <p className="mt-0.5 text-xs text-[#23282E]/45">
                      Gate checks this month
                    </p>
                  </div>
                </motion.div>

                {/* Physics metadata footer */}
                <motion.div
                  variants={item}
                  className="mt-6 flex items-center gap-4"
                >
                  <span className="font-monoData text-[11px] text-[#23282E]/20">
                    ΔF = α · ln(C / C₀)
                  </span>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Bottom feature pills — Infinite Marquee */}
        <div
          className="relative flex w-full overflow-hidden pb-10"
          style={{
            maskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)',
            WebkitMaskImage: 'linear-gradient(to right, transparent, black 25%, black 75%, transparent)'
          }}
        >
          <motion.div
            animate={{
              x: [0, -1200],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "linear",
            }}
            className="flex flex-nowrap items-center gap-10 text-[11px] uppercase tracking-[0.14em] text-floral/40 whitespace-nowrap"
          >
            {/* Group of 3 (Repeated for infinite effect) */}
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex gap-10">
                <span className="inline-flex items-center gap-2 rounded-full border border-floral/10 bg-floral/[0.03] px-3.5 py-1.5 backdrop-blur-sm">
                  <Shield size={10} className="text-sage" />
                  Per-repo budgets
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-floral/10 bg-floral/[0.03] px-3.5 py-1.5 backdrop-blur-sm">
                  <BarChart3 size={10} className="text-sage" />
                  EU CBAM aligned
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-floral/10 bg-floral/[0.03] px-3.5 py-1.5 backdrop-blur-sm">
                  <Zap size={10} className="text-sage" />
                  Fourier carbon forecasting
                </span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
