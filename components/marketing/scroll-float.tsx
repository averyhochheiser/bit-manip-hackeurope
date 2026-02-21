"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

type ScrollFloatProps = {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  className?: string;
};

export function ScrollFloat({ children, delay = 0, distance = 24, className }: ScrollFloatProps) {
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0.18, 0.95], [distance, 0]);

  return (
    <motion.div
      className={className}
      style={reducedMotion ? undefined : { y }}
      initial={{ opacity: 0, y: reducedMotion ? 0 : 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.45, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
