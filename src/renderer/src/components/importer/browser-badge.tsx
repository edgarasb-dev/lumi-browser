import { cn } from "@/lib/utils";
import type { BrowserEngineFamily } from "~/types/importer";

interface BrandStyle {
  short: string;
  gradient: string;
  ring: string;
}

const BRAND_STYLES: Record<string, BrandStyle> = {
  chrome: { short: "Cr", gradient: "from-amber-400 via-rose-500 to-emerald-500", ring: "ring-amber-400/30" },
  "chrome-beta": { short: "Cβ", gradient: "from-sky-400 to-blue-600", ring: "ring-sky-400/30" },
  "chrome-dev": { short: "Cd", gradient: "from-indigo-400 to-violet-600", ring: "ring-indigo-400/30" },
  "chrome-canary": { short: "Cc", gradient: "from-yellow-400 to-amber-500", ring: "ring-yellow-400/30" },
  safari: { short: "Sf", gradient: "from-sky-400 to-blue-600", ring: "ring-sky-400/30" },
  "safari-tp": { short: "ST", gradient: "from-purple-500 to-indigo-600", ring: "ring-purple-400/30" },
  firefox: { short: "Fx", gradient: "from-orange-400 via-rose-500 to-purple-600", ring: "ring-orange-400/30" },
  zen: { short: "Zn", gradient: "from-zinc-700 to-neutral-900", ring: "ring-zinc-400/30" },
  arc: { short: "Ar", gradient: "from-rose-400 via-fuchsia-500 to-indigo-500", ring: "ring-rose-400/30" },
  dia: { short: "Di", gradient: "from-cyan-400 to-blue-600", ring: "ring-cyan-400/30" },
  comet: { short: "Co", gradient: "from-teal-400 to-cyan-600", ring: "ring-teal-400/30" },
  atlas: { short: "At", gradient: "from-emerald-400 to-teal-700", ring: "ring-emerald-400/30" },
  brave: { short: "Br", gradient: "from-orange-500 to-red-600", ring: "ring-orange-500/30" },
  edge: { short: "Ed", gradient: "from-cyan-400 via-sky-500 to-blue-600", ring: "ring-sky-400/30" },
  vivaldi: { short: "Vi", gradient: "from-red-500 to-rose-600", ring: "ring-red-400/30" },
  opera: { short: "Op", gradient: "from-red-500 to-rose-700", ring: "ring-red-500/30" },
  "opera-gx": { short: "GX", gradient: "from-fuchsia-500 to-rose-600", ring: "ring-fuchsia-400/30" },
  "opera-air": { short: "OA", gradient: "from-sky-300 to-indigo-500", ring: "ring-sky-300/30" },
  orion: { short: "Or", gradient: "from-violet-500 to-purple-700", ring: "ring-violet-400/30" },
  helium: { short: "He", gradient: "from-sky-400 to-cyan-500", ring: "ring-sky-400/30" },
  duckduckgo: { short: "DD", gradient: "from-orange-500 to-amber-600", ring: "ring-orange-400/30" },
  librewolf: { short: "LW", gradient: "from-sky-500 to-blue-700", ring: "ring-sky-500/30" },
  waterfox: { short: "Wf", gradient: "from-blue-400 to-cyan-600", ring: "ring-blue-400/30" },
  floorp: { short: "Fl", gradient: "from-indigo-500 to-blue-600", ring: "ring-indigo-400/30" },
  thorium: { short: "Th", gradient: "from-slate-500 to-sky-700", ring: "ring-slate-400/30" },
  tor: { short: "To", gradient: "from-purple-600 to-fuchsia-800", ring: "ring-purple-400/30" },
  mullvad: { short: "Mu", gradient: "from-amber-500 to-yellow-600", ring: "ring-amber-400/30" },
  flow: { short: "Fw", gradient: "from-blue-500 to-indigo-600", ring: "ring-blue-400/30" }
};

const FAMILY_FALLBACK: Record<BrowserEngineFamily, BrandStyle> = {
  chromium: { short: "Ch", gradient: "from-blue-500 to-cyan-600", ring: "ring-blue-400/30" },
  gecko: { short: "Gk", gradient: "from-orange-500 to-purple-600", ring: "ring-orange-400/30" },
  safari: { short: "Wk", gradient: "from-sky-400 to-blue-600", ring: "ring-sky-400/30" },
  orion: { short: "Or", gradient: "from-violet-500 to-purple-700", ring: "ring-violet-400/30" },
  duckduckgo: { short: "DD", gradient: "from-orange-500 to-amber-600", ring: "ring-orange-400/30" },
  flow: { short: "Fw", gradient: "from-blue-500 to-indigo-600", ring: "ring-blue-400/30" }
};

export function BrowserBadge({
  browserId,
  name,
  family,
  className
}: {
  browserId: string;
  name: string;
  family: BrowserEngineFamily;
  className?: string;
}) {
  const style = BRAND_STYLES[browserId] ?? FAMILY_FALLBACK[family];
  const label = style.short || name.slice(0, 2).toUpperCase();

  return (
    <div
      className={cn(
        "size-9 rounded-xl bg-linear-to-br text-white font-bold text-xs tracking-tight flex items-center justify-center shrink-0 shadow-xs ring-1",
        style.gradient,
        style.ring,
        className
      )}
      aria-hidden
    >
      {label}
    </div>
  );
}
