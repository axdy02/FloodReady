"use client";

import { motion, useInView, useSpring, useTransform } from "motion/react";
import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import styles from "./counter.module.css";

type Place = number | ".";

function Number({ value, number, height }: { value: ReturnType<typeof useSpring>; number: number; height: number }) {
  const y = useTransform(value, (latest) => {
    const placeValue = latest % 10;
    let offset = (10 + number - placeValue) % 10;
    if (offset > 5) offset -= 10;
    return offset * height;
  });
  return <motion.span className={styles.number} style={{ y }}>{number}</motion.span>;
}

function Digit({ place, value, height, active }: { place: Place; value: number; height: number; active: boolean }) {
  const target = place === "." ? 0 : Math.floor(value / place);
  const animatedValue = useSpring(0, { stiffness: 170, damping: 24 });
  useEffect(() => {
    if (place !== "." && active) animatedValue.set(target);
  }, [active, animatedValue, place, target]);
  if (place === ".") return <span className={styles.digit} style={{ height, width: "fit-content" }}>.</span>;
  return <span className={styles.digit} style={{ height }}>{Array.from({ length: 10 }, (_, number) => <Number key={number} value={animatedValue} number={number} height={height} />)}</span>;
}

function placesFor(value: number): Place[] {
  const [whole = "0", decimal] = Math.abs(value).toString().split(".");
  const wholePlaces = whole.split("").map((_, index) => 10 ** (whole.length - index - 1));
  return decimal === undefined ? wholePlaces : [...wholePlaces, ".", ...decimal.split("").map((_, index) => 10 ** -(index + 1))];
}

export function Counter({
  value,
  places,
  fontSize = 36,
  padding = 0,
  gap = 2,
  textColor = "inherit",
  fontWeight = 600,
  className,
  style,
}: {
  value: number;
  places?: Place[];
  fontSize?: number;
  padding?: number;
  gap?: number;
  textColor?: string;
  fontWeight?: number | string;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const resolvedPlaces = useMemo(() => places ?? placesFor(value), [places, value]);
  const height = fontSize + padding;
  return <span ref={ref} className={`${styles.container} ${className ?? ""}`} style={style}>
    <span className={styles.counter} style={{ fontSize, gap, color: textColor, fontWeight }}>
      {resolvedPlaces.map((place, index) => <Digit key={`${place}-${index}`} place={place} value={value} height={height} active={inView} />)}
    </span>
    <span className={styles.gradient} aria-hidden="true"><span className={styles.top} style={{ height: 6, background: "linear-gradient(to bottom, rgba(23,23,26,.7), transparent)" }} /><span className={styles.bottom} style={{ height: 6, background: "linear-gradient(to top, rgba(23,23,26,.7), transparent)" }} /></span>
  </span>;
}
