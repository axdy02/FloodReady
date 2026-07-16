"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <main className="mx-auto max-w-2xl px-4 py-12"><ErrorState title="Unable to load this view" description="The requested view could not be loaded. No report or incident status is implied." retry={reset} /></main>;
}
