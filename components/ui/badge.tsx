type BadgeProps = {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
};

const toneMap = {
  neutral: "border border-slate-500/40 bg-slate-500/10 text-slate-200",
  success: "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  warning: "border border-amber-500/40 bg-amber-500/10 text-amber-200",
  danger: "border border-red-500/40 bg-red-500/10 text-red-200",
  info: "border border-cyan-500/40 bg-cyan-500/10 text-cyan-200",
};

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${toneMap[tone]}`}>
      {children}
    </span>
  );
}
