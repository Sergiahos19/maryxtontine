import { Bell, CalendarCheck, HandCoins } from "lucide-react";

import { ContributionRing, type RingDayState } from "@/components/brand/contribution-ring";
import { IconChip } from "@/components/ui/icon-chip";

const WEEKS: { state: RingDayState }[] = Array.from({ length: 14 }, (_, index) => ({
  state: index < 12 ? "paid" : index === 12 ? "today" : "none",
}));

/** Aperçu fidèle de l’espace membre, rendu en HTML dans un cadre de téléphone. */
export function PhonePreview({ dailyContribution }: { dailyContribution: number }) {
  const fmt = (value: number) => `${value.toLocaleString("fr-FR")} FCFA`;
  const rows = [
    { icon: CalendarCheck, tone: "accent" as const, title: "Cotisation, 7 jours", date: "Aujourd’hui", amount: dailyContribution * 7 },
    { icon: CalendarCheck, tone: "accent" as const, title: "Cotisation, 1 jour", date: "Hier", amount: dailyContribution },
    { icon: HandCoins, tone: "ok" as const, title: "Régularisation", date: "Lundi", amount: dailyContribution * 2 },
  ];

  return (
    <div className="relative mx-auto w-[17.5rem] sm:w-[19rem]" aria-hidden>
      <div className="rounded-[2.75rem] border-[9px] border-[#0b1424] bg-bg p-3 shadow-[var(--shadow-float)] ring-1 ring-white/15">
        <div className="mx-auto mb-3 h-5 w-24 rounded-full bg-[#0b1424]" />
        <div className="flex items-center justify-between px-1">
          <p className="text-[11px] text-muted">Bonjour, Awa</p>
          <Bell className="h-3.5 w-3.5 text-muted" />
        </div>

        <div className="brand-card mt-2.5 flex items-center justify-between gap-2 rounded-[1.4rem]! p-4">
          <div>
            <p className="brand-muted text-[10px]">Votre situation</p>
            <p className="mt-1 font-display text-2xl leading-none font-bold">À jour</p>
            <p className="brand-muted mt-1.5 text-[10px]">Réglé jusqu’au 20 oct.</p>
          </div>
          <ContributionRing days={WEEKS} title="12 jours cotisés sur 14" className="w-[4.6rem]">
            <span className="font-display text-sm font-bold tabular">12</span>
          </ContributionRing>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {[1, 7, 30].map((days) => (
            <span key={days} className={`rounded-full border py-1 text-center text-[10px] font-medium ${days === 7 ? "border-accent bg-accent-soft text-accent" : "border-line text-muted"}`}>
              {days === 1 ? "1 jour" : `${days} jours`}
            </span>
          ))}
        </div>
        <div className="mt-2 rounded-full bg-accent py-2 text-center text-[11px] font-semibold text-accent-ink">Payer {fmt(dailyContribution * 7)}</div>

        <p className="mt-4 px-1 text-[11px] font-semibold text-ink">Dernières transactions</p>
        <ul className="mt-1.5 space-y-1.5 pb-2">
          {rows.map((row) => (
            <li key={row.title + row.date} className="flex items-center gap-2 rounded-2xl bg-surface p-2">
              <IconChip icon={row.icon} tone={row.tone} className="h-7! w-7! rounded-lg!" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10.5px] font-medium text-ink">{row.title}</p>
                <p className="text-[9.5px] text-muted">{row.date}</p>
              </div>
              <p className="font-display text-[10.5px] font-semibold text-ink tabular">{fmt(row.amount)}</p>
            </li>
          ))}
        </ul>
      </div>

    </div>
  );
}
