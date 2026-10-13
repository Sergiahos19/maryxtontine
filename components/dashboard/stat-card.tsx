import type { LucideIcon } from "lucide-react";

import { IconChip, type ChipTone } from "@/components/ui/icon-chip";

type StatProps = {
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "ok" | "warn" | "bad";
  icon?: LucideIcon;
};

const valueTone = {
  default: "text-ink",
  ok: "text-ok",
  warn: "text-warn",
  bad: "text-bad",
};

const chipTone: Record<NonNullable<StatProps["tone"]>, ChipTone> = {
  default: "accent",
  ok: "ok",
  warn: "warn",
  bad: "bad",
};

export function Stat({ label, value, detail, tone = "default", icon }: StatProps) {
  return (
    <div className="card min-w-0 p-4">
      {icon ? <IconChip icon={icon} tone={chipTone[tone]} className="mb-3" /> : null}
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 truncate font-display text-xl font-semibold tabular sm:text-2xl ${valueTone[tone]}`}>{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted">{detail}</p> : null}
    </div>
  );
}
