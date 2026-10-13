import { CalendarCheck, CircleDollarSign, HandCoins, RotateCcw, SlidersHorizontal, type LucideIcon } from "lucide-react";

import { IconChip, type ChipTone } from "@/components/ui/icon-chip";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { paymentMethodLabel, transactionStatusLabel, transactionTypeLabel } from "@/lib/labels";

export type TransactionItem = {
  id: string;
  amount: number;
  type: string;
  method: string;
  status: string;
  createdAt: string;
  memberName?: string;
};

const typeIcon: Record<string, { icon: LucideIcon; tone: ChipTone }> = {
  CONTRIBUTION: { icon: CalendarCheck, tone: "accent" },
  DEBT_PAYMENT: { icon: HandCoins, tone: "ok" },
  PARTIAL_PAYMENT: { icon: CircleDollarSign, tone: "warn" },
  ADJUSTMENT: { icon: SlidersHorizontal, tone: "neutral" },
  REFUND: { icon: RotateCcw, tone: "neutral" },
};

export function TransactionList({ items, empty, showMember = false }: { items: TransactionItem[]; empty: string; showMember?: boolean }) {
  if (!items.length) {
    return <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{empty}</p>;
  }
  return (
    <ul className="-my-1 divide-y divide-line">
      {items.map((item) => {
        const visual = typeIcon[item.type] ?? typeIcon.ADJUSTMENT;
        const pending = item.status !== "SUCCESS";
        return (
          <li key={item.id} className="flex items-center gap-3 py-3">
            <IconChip icon={visual.icon} tone={visual.tone} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink">{showMember && item.memberName ? item.memberName : transactionTypeLabel(item.type)}</p>
              <p className="truncate text-xs text-muted">
                {showMember ? `${transactionTypeLabel(item.type)}, ` : ""}{paymentMethodLabel(item.method)}, {formatDate(item.createdAt)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display font-semibold text-ink tabular">{formatCurrency(Number(item.amount))}</p>
              <p className={`text-xs ${pending ? "text-warn" : "text-ok"}`}>{transactionStatusLabel(item.status)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
