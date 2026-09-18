import Link from "next/link";

export default function NotFoundPage() {
  return <main className="mx-auto max-w-2xl px-4 py-12"><h1>Page not found</h1><p>The requested FloodReady page is unavailable.</p><Link href="/">Return to FloodReady</Link></main>;
}
