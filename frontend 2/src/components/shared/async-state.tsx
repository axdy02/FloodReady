import type { ReactNode } from "react";

export function AsyncState({ title, children }: { title: string; children: ReactNode }) {
  return <section aria-live="polite" aria-label={title} className="rounded-lg border p-4"><h2 className="font-semibold">{title}</h2><div>{children}</div></section>;
}
