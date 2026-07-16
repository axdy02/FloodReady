"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

function TransitionFrame({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return <div data-page-transition data-visible={visible}>{children}</div>;
}

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <TransitionFrame key={pathname}>{children}</TransitionFrame>;
}
