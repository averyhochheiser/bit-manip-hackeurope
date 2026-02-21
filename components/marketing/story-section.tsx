"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform
} from "framer-motion";

type ChapterProps = {
  children: React.ReactNode;
  opacity: ReturnType<typeof useTransform<number, number>>;
  y: ReturnType<typeof useTransform<number, number>>;
  className?: string;
};

function Chapter({ children, opacity, y, className }: ChapterProps) {
  return (
    <motion.div
      className={`pointer-events-none sticky top-0 flex min-h-screen flex-col items-center justify-center px-6 ${className || ""}`}
      style={{ opacity, y }}
    >
      {children}
    </motion.div>
  );
}

export function StorySection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const ch1Opacity = useTransform(
    scrollYProgress,
    [0, 0.12, 0.2, 0.25],
    [0, 1, 1, 0]
  );
  const ch1Y = useTransform(
    scrollYProgress,
    [0, 0.12, 0.25],
    [reducedMotion ? 0 : 40, 0, reducedMotion ? 0 : -30]
  );

  const ch2Opacity = useTransform(
    scrollYProgress,
    [0.22, 0.32, 0.42, 0.48],
    [0, 1, 1, 0]
  );
  const ch2Y = useTransform(
    scrollYProgress,
    [0.22, 0.32, 0.48],
    [reducedMotion ? 0 : 40, 0, reducedMotion ? 0 : -30]
  );

  const ch3Opacity = useTransform(
    scrollYProgress,
    [0.45, 0.55, 0.65, 0.72],
    [0, 1, 1, 0]
  );
  const ch3Y = useTransform(
    scrollYProgress,
    [0.45, 0.55, 0.72],
    [reducedMotion ? 0 : 40, 0, reducedMotion ? 0 : -30]
  );

  const ch4Opacity = useTransform(
    scrollYProgress,
    [0.7, 0.82, 0.92, 1],
    [0, 1, 1, 0.85]
  );
  const ch4Y = useTransform(
    scrollYProgress,
    [0.7, 0.82, 1],
    [reducedMotion ? 0 : 40, 0, 0]
  );

  return (
    <section ref={containerRef} className="relative" style={{ height: "400vh" }}>
      <div className="pointer-events-none sticky top-0 h-screen w-full" />

      <Chapter opacity={ch1Opacity} y={ch1Y}>
        <p className="mb-6 text-[10px] uppercase tracking-widest text-stoneware-green">
          The invisible footprint
        </p>
        <h2 className="max-w-3xl text-balance text-center text-4xl font-normal leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-7xl">
          Every training run leaves a trace.
        </h2>
        <p className="mt-8 max-w-lg text-center text-base font-light text-ink-muted">
          GPU hours become kilowatt-hours become kilograms of CO&#x2082;. Most
          teams never see it.
        </p>
      </Chapter>

      <Chapter opacity={ch2Opacity} y={ch2Y}>
        <p className="mb-6 text-[10px] uppercase tracking-widest text-stoneware-turquoise">
          Physics over guesswork
        </p>
        <h2 className="max-w-3xl text-balance text-center text-4xl font-normal leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-7xl">
          Standard models guess. We calculate.
        </h2>
        <div className="mt-12 flex flex-wrap justify-center gap-6">
          <motion.div
            className="max-w-xs rounded border-[0.5px] border-border-subtle bg-canvas-raised px-6 py-8"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <p className="text-[10px] uppercase tracking-widest text-ink-muted">
              Dynamic PUE
            </p>
            <p className="mt-3 font-mono text-lg font-light text-ink">
              1 + Q<sub>cooling</sub> / P<sub>IT</sub>
            </p>
            <p className="mt-3 text-xs font-light text-ink-muted">
              Efficiency that breathes with the ambient air.
            </p>
          </motion.div>
          <motion.div
            className="max-w-xs rounded border-[0.5px] border-border-subtle bg-canvas-raised px-6 py-8"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <p className="text-[10px] uppercase tracking-widest text-ink-muted">
              Fourier Carbon Intensity
            </p>
            <p className="mt-3 font-mono text-lg font-light text-ink">
              CI(t) = &Sigma; a&#x2099; cos(n&omega;t + &phi;&#x2099;)
            </p>
            <p className="mt-3 text-xs font-light text-ink-muted">
              Grid carbon oscillates. We model the harmonics.
            </p>
          </motion.div>
          <motion.div
            className="max-w-xs rounded border-[0.5px] border-border-subtle bg-canvas-raised px-6 py-8"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <p className="text-[10px] uppercase tracking-widest text-ink-muted">
              Radiative Forcing
            </p>
            <p className="mt-3 font-mono text-lg font-light text-ink">
              &Delta;F = &alpha; &middot; ln(C / C&#x2080;)
            </p>
            <p className="mt-3 text-xs font-light text-ink-muted">
              Your emissions shift the atmosphere&apos;s energy balance.
            </p>
          </motion.div>
        </div>
        <p className="mt-8 max-w-md text-center text-xs font-light italic text-ink-faint">
          150kg CO&#x2082; of embodied carbon before the first line of code.
        </p>
      </Chapter>

      <Chapter opacity={ch3Opacity} y={ch3Y}>
        <p className="mb-6 text-[10px] uppercase tracking-widest text-ink-muted">
          The solution
        </p>
        <h2 className="max-w-3xl text-balance text-center text-4xl font-normal leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-7xl">
          Harnessing wasted energy for clean compute.
        </h2>
        <p className="mt-8 max-w-lg text-center text-base font-light text-ink-muted">
          Crusoe repurposes stranded gas into GPU cycles. Carbon Gate routes your
          dirtiest workloads there automatically, cutting emissions up to 88%.
        </p>
      </Chapter>

      <Chapter opacity={ch4Opacity} y={ch4Y}>
        <p className="mb-6 text-[10px] uppercase tracking-widest text-stoneware-turquoise">
          The gate
        </p>
        <h2 className="max-w-3xl text-balance text-center text-4xl font-normal leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-7xl">
          Policy enforced on every&nbsp;
          <span className="text-stoneware-turquoise">PR.</span>
        </h2>
        <p className="mt-8 max-w-lg text-center text-base font-light text-ink-muted">
          Pass, warn, or reroute. The dashboard below is not a mockup.
        </p>
        <div className="pointer-events-auto mt-10">
          <span className="inline-flex items-center gap-2.5 rounded border-[0.5px] border-stoneware-green/30 bg-stoneware-green/5 px-5 py-2 text-[10px] uppercase tracking-widest text-stoneware-green">
            <span className="h-1.5 w-1.5 rounded-full bg-stoneware-green" />
            Gate active
          </span>
        </div>
      </Chapter>
    </section>
  );
}
