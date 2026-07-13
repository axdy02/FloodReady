import Link from "next/link";

export const navigationEntries = [
  { label: "Dashboard", href: "/dashboard", enabled: true },
  { label: "Map", href: "/map", enabled: true },
  { label: "Report", href: "/reports/new", enabled: true },
  { label: "My reports", href: "/reports", enabled: true },
  { label: "Profile", href: "/profile", enabled: true }
] as const;

export function AppNavigation() {
  const enabled = navigationEntries.filter((entry) => entry.enabled);
  if (enabled.length === 0) {
    return null;
  }
  return <nav aria-label="Primary navigation"><ul className="flex items-center gap-1">{enabled.map((entry) => <li key={entry.href}><Link className="rounded-md px-3 py-2 text-sm font-medium text-blue-100 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300" href={entry.href}>{entry.label}</Link></li>)}</ul></nav>;
}
