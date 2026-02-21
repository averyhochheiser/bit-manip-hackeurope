"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { MessageCirclePlus, Command } from "lucide-react";
import { LiquidText } from "@/components/ui/liquid-text";

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
      {/* Subtle overlay */}
      <div className="absolute inset-0 bg-ink/5"></div>

      {/* Content Card Overlay */}
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex w-full max-w-4xl flex-col items-center justify-center text-center gap-8 bg-canvas/95 backdrop-blur-md p-10 lg:p-16 shadow-2xl border-[0.5px] border-ink/10 rounded-[5px]"
      >

        {/* Top Icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="mb-6 flex h-16 w-16 shrink-0 flex-col items-center justify-center"
        >
          <img src="/app-icon.png" alt="Icon" className="w-full h-full object-contain" />
        </motion.div>

        {/* Content */}
        <div className="flex flex-col items-center">
          {/* Animating Pre-title */}
          <div className="mb-6 font-mono text-sm tracking-widest text-stoneware-bordeaux uppercase">
            {preTitle}
          </div>

          {/* Typography 1 (Main Headline) */}
          <h1 className="text-5xl lg:text-7xl font-normal tracking-[-0.04em] text-ink max-w-3xl">
            <LiquidText text="The Invisible Footprint." />
          </h1>

          {/* Typography 2 (Sub Headline) */}
          <h2 className="mt-6 text-2xl lg:text-3xl font-light text-ink/80 tracking-tight max-w-2xl mx-auto">
            <LiquidText text="Sustainability is now a first-class citizen of CI/CD." />
          </h2>

          {/* Dashed Lines Decorative Element */}
          <div className="mt-12 flex items-center justify-center gap-4 opacity-60">
            <div className="h-0 w-16 border-t-[2px] border-dashed border-ink"></div>
            <div className="h-0 w-8 border-t-[2px] border-dashed border-ink"></div>
            <div className="h-0 w-12 border-t-[2px] border-dashed border-ink"></div>
            <div className="h-0 w-24 border-t-[2px] border-dashed border-ink"></div>
            <div className="h-0 w-6 border-t-[2px] border-dashed border-ink"></div>
          </div>
        </div>

      </motion.div>
    </section>
  );
}
