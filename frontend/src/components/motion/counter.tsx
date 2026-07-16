"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import styles from "./counter.module.css";

const digits = Array.from({ length: 10 }, (_, number) => number);

export function Counter({ value, fontSize = 36, padding = 0, gap = 2, className, style }: { value: number; fontSize?: number; padding?: number; gap?: number; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [visible, setVisible] = useState(false);
  const characters = useMemo(() => Math.abs(Math.round(value)).toLocaleString("en-US").split(""), [value]);
  const height = fontSize + padding;

  useEffect(() => {
    if (ref.current === null) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.2 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return <span ref={ref} data-motion-counter className={`${styles.container} ${className ?? ""}`} style={style}>
    <span className={styles.counter} style={{ fontSize, gap, height }} aria-label={String(value)}>
      {characters.map((character, index) => character === "," ? <span key={`separator-${index}`} className={styles.separator}>,</span> : <span key={`${character}-${index}`} className={styles.digit} style={{ height }}><span className={styles.digitColumn} style={{ transform: `translateY(${visible ? -Number(character) * height : 0}px)`, transitionDelay: `${index * 115}ms` }}>{digits.map((digit) => <span key={digit} className={styles.number} style={{ height }}>{digit}</span>)}</span></span>)}
    </span>
  </span>;
}
