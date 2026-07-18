"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (ref.current === null) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "0px 0px -8%", threshold: 0.08 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} data-motion-reveal data-visible={visible} className={className} style={{ opacity: visible ? 1 : 0, transform: visible ? "translate3d(0, 0, 0)" : "translate3d(0, 40px, 0)", transition: `opacity 720ms cubic-bezier(.16,1,.3,1) ${delay}s, transform 720ms cubic-bezier(.16,1,.3,1) ${delay}s`, willChange: visible ? "auto" : "opacity, transform" }}>{children}</div>;
}
