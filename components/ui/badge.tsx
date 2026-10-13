type BadgeProps = {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
};

const toneMap = {
  neutral: "bg-surface-2 text-muted",
  success: "bg-ok-soft text-ok",
  warning: "bg-warn-soft text-warn",
  danger: "bg-bad-soft text-bad",
  info: "bg-accent-soft text-accent",
};

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${toneMap[tone]}`}>
      {children}
    </span>
  );
}
