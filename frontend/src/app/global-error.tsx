"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return <html lang="en"><body><main><h1>Unable to load FloodReady</h1><p>The application could not render this view.</p><button type="button" onClick={reset}>Try again</button></main></body></html>;
}
