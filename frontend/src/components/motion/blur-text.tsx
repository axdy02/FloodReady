"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

type BlurTextProps = {
  text: string;
  className?: string;
  delay?: number;
  as?: "h1" | "h2" | "p";
  style?: CSSProperties;
};

export function BlurText({ text, className = "", delay = 135, as: Element = "p", style }: BlurTextProps) {
  const words = useMemo(() => text.split(" "), [text]);
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (ref.current === null) {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setInView(true);
        observer.disconnect();
      }
    }, { threshold: 0.1 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return <Element data-motion-text className={className} style={style}><span ref={ref} className="flex flex-wrap">
    {words.map((word, index) => <span
      className="mr-[.24em] inline-block will-change-[transform,filter,opacity] last:mr-0"
      key={`${word}-${index}`}
      style={{ filter: inView ? "blur(0px)" : "blur(12px)", opacity: inView ? 1 : 0, transform: inView ? "translateY(0)" : "translateY(42px)", transition: `filter 880ms cubic-bezier(.16,1,.3,1) ${(index * delay) / 1000}s, opacity 880ms cubic-bezier(.16,1,.3,1) ${(index * delay) / 1000}s, transform 880ms cubic-bezier(.16,1,.3,1) ${(index * delay) / 1000}s` }}
    >
      {word}
    </span>)}
  </span></Element>;
}
