"use client";

import { gsap } from "gsap";
import { Menu, Waves } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "./pill-nav.module.css";

export type PillNavItem = { label: string; href: string; ariaLabel?: string };

export function PillNav({ items, activeHref, className = "", initialLoadAnimation = true, showBrand = true }: { items: PillNavItem[]; activeHref: string; className?: string; initialLoadAnimation?: boolean; showBrand?: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const itemsRef = useRef<HTMLUListElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const context = gsap.context(() => {
      if (initialLoadAnimation && itemsRef.current !== null) gsap.fromTo(itemsRef.current, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" });
      gsap.set(`.${styles.circle}`, { scale: 0, xPercent: -50, transformOrigin: "50% 100%" });
    }, navRef);
    return () => context.revert();
  }, [initialLoadAnimation, items]);

  useEffect(() => {
    if (menuRef.current === null) return;
    if (mobileOpen) gsap.fromTo(menuRef.current, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.2, ease: "power2.out" });
  }, [mobileOpen]);

  const animate = (event: React.MouseEvent<HTMLAnchorElement>, entering: boolean) => {
    const circle = event.currentTarget.querySelector(`.${styles.circle}`);
    const label = event.currentTarget.querySelector(`.${styles.label}`);
    const hoverLabel = event.currentTarget.querySelector(`.${styles.hoverLabel}`);
    if (circle === null || label === null || hoverLabel === null) return;
    gsap.to(circle, { scale: entering ? 1.25 : 0, duration: entering ? 0.32 : 0.22, ease: "power3.out", overwrite: "auto" });
    gsap.to(label, { yPercent: entering ? -150 : 0, duration: entering ? 0.28 : 0.2, ease: "power3.out", overwrite: "auto" });
    gsap.to(hoverLabel, { yPercent: entering ? -150 : 0, opacity: entering ? 1 : 0, duration: entering ? 0.28 : 0.2, ease: "power3.out", overwrite: "auto" });
  };

  const isActive = (href: string) => activeHref === href || (href !== "/dashboard" && activeHref.startsWith(`${href}/`));
  return <div className={`${styles.container} ${className}`}>
    <nav ref={navRef} className={styles.nav} aria-label="FloodReady sections">
      {showBrand ? <Link href="/dashboard" aria-label="FloodReady dashboard" className={styles.brand}><Waves className="size-5" /></Link> : null}
      <div className={styles.items}><ul ref={itemsRef} className={styles.list}>{items.map((item) => <li key={item.href}><Link href={item.href} aria-label={item.ariaLabel ?? item.label} className={`${styles.pill} ${isActive(item.href) ? styles.active : ""}`} onMouseEnter={(event) => animate(event, true)} onMouseLeave={(event) => animate(event, false)}><span className={styles.circle} aria-hidden="true" /><span className={styles.labelStack}><span className={styles.label}>{item.label}</span><span className={styles.hoverLabel} aria-hidden="true">{item.label}</span></span></Link></li>)}</ul></div>
      <button type="button" className={styles.menuButton} aria-label="Toggle section navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen((open) => !open)}><Menu className="size-5" /></button>
      <div ref={menuRef} className={`${styles.menu} ${mobileOpen ? styles.menuOpen : ""}`}>{items.map((item) => <Link href={item.href} key={item.href} className={`${styles.menuLink} ${isActive(item.href) ? styles.menuActive : ""}`} onClick={() => setMobileOpen(false)}>{item.label}</Link>)}</div>
    </nav>
  </div>;
}
