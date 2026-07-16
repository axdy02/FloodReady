"use client"

import { Activity, CheckCircle2, RefreshCw, ServerCrash } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

type Status = { frontend: "ok"; backend: "ok" | "unavailable" }

const initial: Status = { frontend: "ok", backend: "unavailable" }

export function ServiceStatus() {
  const [status, setStatus] = useState<Status>(initial)
  const [loading, setLoading] = useState(true)

  const check = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/status", { cache: "no-store" })
      if (response.ok) setStatus(await response.json() as Status)
      else setStatus(initial)
    } catch {
      setStatus(initial)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void check() }, [])

  const backendReady = status.backend === "ok"
  return <section aria-labelledby="service-status" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">Live connection check</p>
        <h2 id="service-status" className="mt-1 text-2xl font-bold text-slate-950">Service status</h2>
      </div>
      <Button type="button" variant="outline" onClick={() => void check()} disabled={loading}>
        <RefreshCw className={loading ? "animate-spin" : ""} />
        {loading ? "Checking" : "Check again"}
      </Button>
    </div>
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      <StatusCard icon={<Activity />} label="Frontend" detail="This browser is receiving the FloodReady app." ready />
      <StatusCard icon={backendReady ? <CheckCircle2 /> : <ServerCrash />} label="Backend API" detail={backendReady ? "The API readiness endpoint responded successfully." : "The frontend is up, but it could not reach the backend readiness endpoint."} ready={backendReady} />
    </div>
  </section>
}

function StatusCard({ icon, label, detail, ready }: { icon: React.ReactNode; label: string; detail: string; ready: boolean }) {
  return <div className={ready ? "rounded-2xl border border-emerald-200 bg-emerald-50 p-4" : "rounded-2xl border border-amber-200 bg-amber-50 p-4"}>
    <div className="flex items-center gap-3"><span className={ready ? "text-emerald-700" : "text-amber-700"}>{icon}</span><p className="font-semibold text-slate-950">{label}</p><span className={ready ? "ml-auto rounded-full bg-emerald-200 px-2 py-1 text-xs font-bold text-emerald-900" : "ml-auto rounded-full bg-amber-200 px-2 py-1 text-xs font-bold text-amber-900"}>{ready ? "Online" : "Needs attention"}</span></div>
    <p className="mt-3 text-sm leading-6 text-slate-700">{detail}</p>
  </div>
}
