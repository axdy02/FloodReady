"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import styles from "./pill-nav.module.css";

export type PillNavItem = {
  label: string;
  href: string;
};

export function PillNav({ items, activeHref }: { items: readonly PillNavItem[]; activeHref: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const isActive = (href: string) => activeHref === href || href !== "/" && activeHref.startsWith(`${href}/`);

  return <nav className={styles.navigation} aria-label="FloodReady sections">
    <ul className={styles.desktopList}>
      {items.map((item) => <li key={item.href}>
        <Link href={item.href} className={`${styles.link} ${isActive(item.href) ? styles.active : ""}`}>
          <span>{item.label}</span>
        </Link>
      </li>)}
    </ul>
    <button
      type="button"
      className={styles.menuButton}
      aria-label={isOpen ? "Close section navigation" : "Open section navigation"}
      aria-expanded={isOpen}
      onClick={() => setIsOpen((open) => !open)}
    >
      {isOpen ? <X className="size-4" /> : <Menu className="size-4" />}
    </button>
    {isOpen ? <div className={styles.mobileMenu}>
      {items.map((item) => <Link href={item.href} key={item.href} className={`${styles.mobileLink} ${isActive(item.href) ? styles.mobileActive : ""}`} onClick={() => setIsOpen(false)}>{item.label}</Link>)}
    </div> : null}
  </nav>;
}
