"use client";

import Link from "next/link";
import { Award, BadgeCheck, BarChart3, Bell, ShieldCheck } from "lucide-react";
import { BlurText } from "@/components/motion/blur-text";
import { Counter } from "@/components/motion/counter";
import { Reveal } from "@/components/motion/reveal";
import { useAppMode } from "@/features/app-mode/app-mode-context";
import { demoAverageConfidence, demoDisplayReports, toLiveDisplayReport } from "@/features/app-mode/mode-data";
import { useAuth } from "@/features/auth/auth-context";
import { useOwnReportsQuery } from "@/features/reports/queries";
import { ProfileForm } from "@/features/users/profile-form";

export default function ProfilePage() {
  const auth = useAuth();
  const { mode } = useAppMode();
  const liveReports = useOwnReportsQuery("", null);
  if (auth.kind !== "AUTHENTICATED" && auth.kind !== "REFRESHING") return null;
  const reports = mode === "demo" ? demoDisplayReports : liveReports.data?.items.map(toLiveDisplayReport) ?? [];
  const submitted = mode === "demo" ? demoDisplayReports.length : liveReports.data?.totalCount ?? 0;
  const verified = reports.filter((report) => report.status === "VERIFIED").length;
  const pending = reports.filter((report) => !["VERIFIED", "RESOLVED"].includes(report.status)).length;
  const activity = Array.from({ length: 12 }, (_, index) => {
    const report = reports[index];
    return report ? report.status === "VERIFIED" ? 82 : report.severity === "CRITICAL" || report.severity === "IMPASSABLE" ? 70 : 52 : 8;
  });
  const isLiveUnavailable = mode === "live" && liveReports.isError;

  return <main className="mx-auto max-w-6xl px-5 py-10">
    <Reveal><section className="surface-card rounded-2xl p-6"><div className="flex flex-wrap items-center gap-5"><span className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-blue-400 to-cyan-400 text-xl font-bold text-zinc-950">{auth.user.name.slice(0, 1).toUpperCase()}</span><div className="flex-1"><p className="text-xs font-semibold tracking-[.18em] text-blue-400">PROFILE · {mode.toUpperCase()} DATA</p><BlurText as="h1" text={auth.user.name} delay={140} className="mt-1 text-3xl font-semibold tracking-[-.04em]" /><p className="mt-1 text-sm text-zinc-500">{auth.user.email} · {auth.user.role.toLowerCase()}</p></div><div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[.06] px-4 py-3"><p className="text-xs text-zinc-500">{mode === "demo" ? "Demo confidence" : "Community trust"}</p><p className="mt-1 flex items-baseline text-xl font-semibold text-emerald-300">{mode === "demo" ? <><Counter value={demoAverageConfidence} fontSize={24} textColor="rgb(110 231 183)" />%</> : "—"}</p></div></div></section></Reveal>
    {mode === "live" ? <p className="mt-4 rounded-xl border border-blue-400/15 bg-blue-500/[.06] px-3 py-2 text-xs text-blue-200">{liveReports.isLoading ? "Loading your live contribution history…" : isLiveUnavailable ? "Live profile data is unavailable. Demo progress is not shown while Live is selected." : "Metrics below use your connected account’s live reports."}</p> : null}
    <section className="mt-4 grid gap-3 sm:grid-cols-3"><Metric icon={<BadgeCheck className="size-4" />} value={submitted} label="Reports submitted" /><Metric icon={<ShieldCheck className="size-4" />} value={verified} label="Reports verified" /><Metric icon={<Award className="size-4" />} value={mode === "demo" ? demoDisplayReports.length : null} label={mode === "demo" ? "Demo contributors" : "Community rank unavailable"} /></section>
    <section className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_.8fr]"><div className="space-y-4"><Reveal><article className="surface-card rounded-2xl p-6"><h2 className="flex items-center gap-2 text-sm font-semibold"><BarChart3 className="size-4 text-blue-400" />Contribution activity</h2><div className="mt-7 flex h-28 items-end gap-2">{activity.map((value, index) => <i key={index} className="flex-1 rounded-t bg-gradient-to-t from-blue-600 to-cyan-300/80" style={{ height: `${value}%`, opacity: value === 8 ? 0.2 : 1 }} />)}</div><p className="mt-3 text-xs text-zinc-500">{mode === "demo" ? `${demoDisplayReports.length} real demo submissions represented in this preview.` : `${submitted} live submission${submitted === 1 ? "" : "s"} in your account.`}</p></article></Reveal><Reveal><article className="surface-card rounded-2xl p-6"><h2 className="text-sm font-semibold">Contribution summary</h2><div className="mt-5 grid gap-2 sm:grid-cols-3"><Summary title="Submitted" value={submitted} detail={mode === "demo" ? "Four shared demo reports" : "Your live reports"} /><Summary title="Verified" value={verified} detail="Confirmed reports" /><Summary title="Pending" value={pending} detail="Need review or follow-up" /></div></article></Reveal></div><Reveal><aside className="surface-card h-fit rounded-2xl p-6"><h2 className="text-sm font-semibold">Account settings</h2><p className="mt-2 text-xs leading-5 text-zinc-500">Update personal details, notification preferences, and account security.</p><div className="mt-5"><ProfileForm /></div><Link href="/settings" className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-blue-300"><Bell className="size-4" />Manage notifications and privacy</Link></aside></Reveal></section>
  </main>;
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: number | null; label: string }) {
  return <Reveal><article className="surface-card rounded-2xl p-5"><span className="text-blue-400">{icon}</span><p className="mt-5 text-2xl font-semibold">{value === null ? "—" : <Counter value={value} fontSize={30} />}</p><p className="mt-1 text-xs text-zinc-500">{label}</p></article></Reveal>;
}

function Summary({ title, value, detail }: { title: string; value: number; detail: string }) {
  return <div className="rounded-xl border border-white/[.06] bg-black/10 p-3"><Award className="size-4 text-amber-300" /><p className="mt-4 flex items-baseline gap-1 text-xs font-semibold">{title}: <Counter value={value} fontSize={14} /></p><p className="mt-1 text-[10px] leading-4 text-zinc-500">{detail}</p></div>;
}
