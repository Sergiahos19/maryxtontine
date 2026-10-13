import type { LucideIcon } from "lucide-react";

export type ChipTone = "accent" | "ok" | "warn" | "bad" | "neutral";

const toneMap: Record<ChipTone, string> = {
  accent: "bg-accent-soft text-accent",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  neutral: "bg-surface-2 text-muted",
};

export function IconChip({ icon: Icon, tone = "accent", className = "" }: { icon: LucideIcon; tone?: ChipTone; className?: string }) {
  return (
    <span className={`icon-chip ${toneMap[tone]} ${className}`} aria-hidden>
      <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
    </span>
  );
}
