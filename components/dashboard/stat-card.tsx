import type { ReactNode } from "react";

type StatCardProps = {
  label: string;
  value: string;
  detail: string;
  accent?: "cyan" | "emerald" | "amber" | "rose";
  icon: ReactNode;
};

const accentMap = {
  cyan: "border-cyan-500/20 bg-cyan-500/10 text-cyan-200",
  emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-200",
  rose: "border-rose-500/20 bg-rose-500/10 text-rose-200",
};

export function StatCard({ label, value, detail, accent = "cyan", icon }: StatCardProps) {
  return (
    <div className={`rounded-2xl border p-5 shadow-lg shadow-slate-950/20 ${accentMap[accent]}`}>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-slate-300">{label}</span>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/60">{icon}</div>
      </div>
      <div className="text-3xl font-semibold text-white">{value}</div>
      <div className="mt-2 text-sm text-slate-300">{detail}</div>
    </div>
  );
}
