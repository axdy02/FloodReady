import { Radar } from "lucide-react";

export function BrandMark({ inverse = false, compact = false }: { inverse?: boolean; compact?: boolean }) {
  return <span className={`inline-flex items-center ${compact ? "gap-2" : "gap-3"}`}>
    <span className={`relative grid ${compact ? "size-8" : "size-10"} place-items-center border ${inverse ? "border-white/25 bg-white text-[#171714]" : "border-[#171714] bg-[#171714] text-[#f7f2e8]"}`}>
      <Radar className={compact ? "size-[1.15rem]" : "size-5"} strokeWidth={1.8} />
      <span className="absolute right-[18%] top-[18%] size-1.5 rounded-full bg-[#f05a28]" />
    </span>
    <span className="leading-none">
      <span className={`block font-black uppercase tracking-[-.045em] ${compact ? "text-base" : "text-lg"}`}>WaterRadar</span>
      {!compact ? <span className={`mt-1 block text-[9px] font-bold uppercase tracking-[.22em] ${inverse ? "text-white/45" : "text-[#656158]"}`}>Street-level water intelligence</span> : null}
    </span>
  </span>;
}
