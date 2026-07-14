"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

type BlurTextProps = {
  text: string;
  className?: string;
  animateBy?: "words" | "letters";
  direction?: "top" | "bottom";
  delay?: number;
  stepDuration?: number;
  threshold?: number;
  rootMargin?: string;
  onAnimationComplete?: () => void;
  as?: "h1" | "h2" | "p";
  style?: CSSProperties;
};

type Snapshot = { filter: string; opacity: number; y: number };

function buildKeyframes(from: Snapshot, steps: Snapshot[]) {
  return { filter: [from.filter, ...steps.map((step) => step.filter)], opacity: [from.opacity, ...steps.map((step) => step.opacity)], y: [from.y, ...steps.map((step) => step.y)] };
}

export function BlurText({
  text,
  className = "",
  animateBy = "words",
  direction = "top",
  delay = 140,
  stepDuration = 0.35,
  threshold = 0.1,
  rootMargin = "0px",
  onAnimationComplete,
  as: Element = "p",
  style,
}: BlurTextProps) {
  const elements = animateBy === "words" ? text.split(" ") : text.split("");
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion || ref.current === null) {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry?.isIntersecting) {
        setInView(true);
        observer.unobserve(entry.target);
      }
    }, { threshold, rootMargin });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [reduceMotion, rootMargin, threshold]);

  const fromSnapshot = useMemo(
    () => direction === "top" ? { filter: "blur(10px)", opacity: 0, y: -36 } : { filter: "blur(10px)", opacity: 0, y: 36 },
    [direction],
  );
  const toSnapshots = useMemo(
    () => [{ filter: "blur(5px)", opacity: 0.5, y: direction === "top" ? 4 : -4 }, { filter: "blur(0px)", opacity: 1, y: 0 }],
    [direction],
  );
  const totalDuration = stepDuration * toSnapshots.length;
  const times = Array.from({ length: toSnapshots.length + 1 }, (_, index) => index / toSnapshots.length);

  return <Element className={className} style={style}><span ref={ref} style={{ display: "flex", flexWrap: "wrap" }}>
    {elements.map((segment, index) => <motion.span
      className="inline-block will-change-[transform,filter,opacity]"
      key={`${segment}-${index}`}
      initial={fromSnapshot}
      animate={inView ? buildKeyframes(fromSnapshot, toSnapshots) : fromSnapshot}
      transition={reduceMotion ? { duration: 0 } : { duration: totalDuration, times, delay: (index * delay) / 1000, ease: "easeOut" }}
      {...(index === elements.length - 1 && onAnimationComplete !== undefined ? { onAnimationComplete } : {})}
    >
      {segment === " " ? "\u00a0" : segment}
      {animateBy === "words" && index < elements.length - 1 ? "\u00a0" : null}
    </motion.span>)}</span>
  </Element>;
}
