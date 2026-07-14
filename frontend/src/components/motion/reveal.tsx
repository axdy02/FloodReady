"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduceMotion = useReducedMotion();
  const supportsIntersectionObserver = typeof IntersectionObserver !== "undefined";
  const visible = { opacity: 1, y: 0 };

  return <motion.div
    className={className}
    initial={reduceMotion ? false : { opacity: 0, y: 40 }}
    {...(supportsIntersectionObserver ? { whileInView: visible, viewport: { once: true, amount: 0.12 } } : { animate: visible })}
    transition={{ duration: reduceMotion ? 0 : 0.6, delay, ease: "easeOut" }}
  >
    {children}
  </motion.div>;
}
