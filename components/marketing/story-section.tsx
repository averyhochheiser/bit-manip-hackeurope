"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform
} from "framer-motion";

function FourierWave({ progress }: { progress: ReturnType<typeof useTransform<number, number>> }) {
  return (
    <motion.svg
      viewBox="0 0 1200 200"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-56 w-full opacity-[0.12]"
      style={{ x: progress }}
    >
      <path
        d="M0,120 C100,60 200,180 300,100 C400,20 500,160 600,100 C700,40 800,170 900,90 C1000,10 1100,150 1200,100"
        fill="none"
        stroke="#98D2EB"
        strokeWidth="1.5"
      />
      <path
        d="M0,140 C120,80 240,190 360,120 C480,50 600,175 720,110 C840,45 960,180 1080,100 L1200,120"
        fill="none"
        stroke="#98D2EB"
        strokeWidth="0.8"
        opacity="0.5"
      />
    </motion.svg>
  );
}

type ChapterProps = {
  children: React.ReactNode;
  opacity: ReturnType<typeof useTransform<number, number>>;
  y: ReturnType<typeof useTransform<number, number>>;
  x: ReturnType<typeof useTransform<number, number>>;
  className?: string;
};

function Chapter({ children, opacity, y, x, className }: ChapterProps) {
  return (
    <motion.div
      className={`pointer-events-none sticky top-0 flex min-h-screen flex-col items-center justify-center px-4 ${className || ""}`}
      style={{ opacity, y, x }}
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

  const ch1Opacity = useTransform(scrollYProgress, [0, 0.05, 0.25, 0.3], [0, 1, 1, 0]);
  const ch1Y = useTransform(scrollYProgress, [0, 0.05, 0.3], [reducedMotion ? 0 : 20, 0, reducedMotion ? 0 : -20]);
  const ch1X = useTransform(scrollYProgress, [0, 0.05, 0.3], [reducedMotion ? 0 : 100, 0, reducedMotion ? 0 : -100]);

  const ch2Opacity = useTransform(scrollYProgress, [0.25, 0.32, 0.52, 0.58], [0, 1, 1, 0]);
  const ch2Y = useTransform(scrollYProgress, [0.25, 0.32, 0.58], [reducedMotion ? 0 : 20, 0, reducedMotion ? 0 : -20]);
  const ch2X = useTransform(scrollYProgress, [0.25, 0.32, 0.58], [reducedMotion ? 0 : -100, 0, reducedMotion ? 0 : 100]);

  const ch3Opacity = useTransform(scrollYProgress, [0.5, 0.58, 0.78, 0.84], [0, 1, 1, 0]);
  const ch3Y = useTransform(scrollYProgress, [0.5, 0.58, 0.84], [reducedMotion ? 0 : 20, 0, reducedMotion ? 0 : -20]);
  const ch3X = useTransform(scrollYProgress, [0.5, 0.58, 0.84], [reducedMotion ? 0 : 100, 0, reducedMotion ? 0 : -100]);

  const ch4Opacity = useTransform(scrollYProgress, [0.75, 0.82, 0.98, 1], [0, 1, 1, 0.9]);
  const ch4Y = useTransform(scrollYProgress, [0.75, 0.82, 1], [reducedMotion ? 0 : 20, 0, 0]);
  const ch4X = useTransform(scrollYProgress, [0.75, 0.82, 1], [reducedMotion ? 0 : -100, 0, 0]);

  const sageBg = useTransform(
    scrollYProgress,
    [0, 0.08, 0.2, 0.25],
    ["rgba(105,153,93,0)", "rgba(105,153,93,0.06)", "rgba(105,153,93,0.06)", "rgba(105,153,93,0)"]
  );

  const waveX = useTransform(scrollYProgress, [0, 1], [0, reducedMotion ? 0 : -180]);

  return (
    <section ref={containerRef} className="relative" style={{ height: "400vh" }}>
      <motion.div
        className="pointer-events-none sticky top-0 h-screen w-full overflow-hidden"
        style={{ backgroundColor: sageBg }}
      >
        <FourierWave progress={waveX} />
      </motion.div>

      {/* Chapter 1: The Invisible Footprint */}
      <Chapter opacity={ch1Opacity} y={ch1Y} x={ch1X}>
        <p className="mb-4 text-xs uppercase tracking-[0.25em] text-sage">The invisible footprint</p>
        <h2 className="max-w-4xl text-balance text-center font-display text-5xl font-bold leading-[1.1] text-floral sm:text-6xl lg:text-8xl">
          Every training run leaves a trace.
        </h2>
        <p className="mt-6 max-w-xl text-center text-base text-floral/50">
          GPU hours become kilowatt-hours become kilograms of CO&#x2082;. Most teams never see it.
        </p>
      </Chapter>

      {/* Chapter 2: Physics Over Guesswork */}
      <Chapter opacity={ch2Opacity} y={ch2Y} x={ch2X}>
        <p className="mb-4 text-xs uppercase tracking-[0.25em] text-crusoe">Physics over guesswork</p>
        <h2 className="max-w-4xl text-balance text-center font-display text-5xl font-bold leading-[1.1] text-floral sm:text-6xl lg:text-8xl">
          Standard models guess. We calculate.
        </h2>
        <div className="mt-10 flex flex-wrap justify-center gap-6">
          <motion.div
            className="panel-muted max-w-xs p-5"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            <p className="text-xs uppercase tracking-[0.18em] text-floral/50">Dynamic PUE</p>
            <p className="mt-2 font-monoData text-lg text-floral/85">
              1 + Q<sub>cooling</sub> / P<sub>IT</sub>
            </p>
            <p className="mt-2 text-xs text-floral/45">
              Efficiency that breathes with the ambient air.
            </p>
          </motion.div>
          <motion.div
            className="panel-muted max-w-xs p-5"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <p className="text-xs uppercase tracking-[0.18em] text-floral/50">Fourier Carbon Intensity</p>
            <p className="mt-2 font-monoData text-lg text-floral/85">
              CI(t) = &Sigma; a&#x2099; cos(n&omega;t + &phi;&#x2099;)
            </p>
            <p className="mt-2 text-xs text-floral/45">
              Grid carbon oscillates. We model the harmonics.
            </p>
          </motion.div>
          <motion.div
            className="panel-muted max-w-xs p-5"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <p className="text-xs uppercase tracking-[0.18em] text-floral/50">Radiative Forcing</p>
            <p className="mt-2 font-monoData text-lg text-floral/85">
              &Delta;F = &alpha; &middot; ln(C / C&#x2080;)
            </p>
            <p className="mt-2 text-xs text-floral/45">
              Your emissions shift the atmosphere&apos;s energy balance.
            </p>
          </motion.div>
        </div>
        <p className="mt-6 max-w-md text-center text-sm italic text-floral/35">
          150kg CO&#x2082; of embodied carbon before the first line of code.
        </p>
      </Chapter>

      {/* Chapter 3: The Solution */}
      <Chapter opacity={ch3Opacity} y={ch3Y} x={ch3X}>
        <p className="mb-4 text-xs uppercase tracking-[0.25em] text-floral/40">The solution</p>
        <h2 className="max-w-4xl text-balance text-center font-display text-5xl font-bold leading-[1.1] text-floral sm:text-6xl lg:text-8xl">
          Harnessing wasted energy for clean compute.
        </h2>
        <p className="mt-6 max-w-xl text-center text-base text-floral/50">
          Crusoe repurposes stranded gas into GPU cycles. Carbon Gate routes your dirtiest workloads
          there automatically, cutting emissions up to 88%.
        </p>
      </Chapter>

      {/* Chapter 4: The Gate */}
      <Chapter opacity={ch4Opacity} y={ch4Y} x={ch4X}>
        <p className="mb-4 text-xs uppercase tracking-[0.25em] text-crusoe">The gate</p>
        <h2 className="max-w-4xl text-balance text-center font-display text-5xl font-bold leading-[1.1] text-floral sm:text-6xl lg:text-8xl">
          Policy enforced on every&nbsp;
          <span className="text-crusoe">PR.</span>
        </h2>
        <p className="mt-6 max-w-xl text-center text-base text-floral/50">
          Pass, warn, or reroute. The dashboard below is not a mockup.
        </p>
        <div className="pointer-events-auto mt-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-crusoe/30 bg-crusoe/10 px-4 py-1.5 text-xs font-medium text-crusoe">
            <span className="h-1.5 w-1.5 rounded-full bg-crusoe" />
            Gate active
          </span>
        </div>
      </Chapter>
    </section>
  );
}
