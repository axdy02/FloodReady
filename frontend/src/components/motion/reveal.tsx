"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (ref.current === null) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.12 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} data-motion-reveal className={className} style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(48px)", transition: `opacity 900ms cubic-bezier(.16,1,.3,1) ${delay}s, transform 900ms cubic-bezier(.16,1,.3,1) ${delay}s` }}>{children}</div>;
}
