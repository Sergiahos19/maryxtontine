import Link from "next/link";
import { connection } from "next/server";
import { CalendarCheck, CalendarPlus, CircleAlert, FileCheck2, HandCoins, LockKeyhole, Plus, ShieldCheck, Smartphone, type LucideIcon } from "lucide-react";

import { ContributionRing, type RingDayState } from "@/components/brand/contribution-ring";
import { PhonePreview } from "@/components/brand/phone-preview";
import { Footer } from "@/components/layout/footer";
import { SiteHeader } from "@/components/layout/site-header";
import { IconChip, type ChipTone } from "@/components/ui/icon-chip";
import { getDailyContribution, getDailyLatePenalty } from "@/lib/database";
import { formatCurrency } from "@/lib/formatters";

// Le grand cercle de l’accueil : un mois, 23 jours cotisés, aujourd’hui, puis les jours à venir.
const MONTH: { state: RingDayState }[] = Array.from({ length: 30 }, (_, index) => ({
  state: index < 23 ? "paid" : index === 23 ? "today" : "none",
}));

type WeekDay = {
  day: string;
  title: string;
  detail: string;
  amount: string;
  icon: LucideIcon;
  tone: ChipTone;
  state: RingDayState;
};

export default async function HomePage() {
  await connection();
  const [c, p] = await Promise.all([getDailyContribution(), getDailyLatePenalty()]);
  const fcfa = (value: number) => formatCurrency(value);

  // Une semaine réelle, calculée avec les tarifs en vigueur et les règles appliquées par MARYX.
  const week: WeekDay[] = [
    { day: "Lun", title: "Cotisation du jour", detail: "Payée par Mobile Money, reçu PDF disponible.", amount: fcfa(c), icon: CalendarCheck, tone: "accent", state: "paid" },
    { day: "Mar", title: "Cotisation du jour", detail: "Le cercle avance d’un segment.", amount: fcfa(c), icon: CalendarCheck, tone: "accent", state: "paid" },
    { day: "Mer", title: "Jour oublié", detail: "La cotisation du jour reste due.", amount: `${fcfa(c)} dus`, icon: CircleAlert, tone: "bad", state: "unpaid" },
    {
      day: "Jeu",
      title: p > 0 ? "Pénalité de retard" : "Toujours en retard",
      detail: p > 0 ? "Une seule par jour, même si plusieurs jours manquent. Une alerte apparaît dans votre espace." : "Aucune pénalité n’est appliquée actuellement.",
      amount: p > 0 ? `+ ${fcfa(p)}` : fcfa(0),
      icon: CircleAlert,
      tone: "warn",
      state: "unpaid",
    },
    {
      day: "Ven",
      title: "Tout est régularisé",
      detail: p > 0 ? "Le paiement règle d’abord les deux pénalités (jeudi et vendredi), puis mercredi, jeudi et vendredi." : "Le paiement règle mercredi, jeudi puis vendredi.",
      amount: fcfa(2 * p + 3 * c),
      icon: HandCoins,
      tone: "ok",
      state: "paid",
    },
    { day: "Sam", title: "Sept jours d’avance", detail: "Couverts à la suite, jusqu’au vendredi suivant.", amount: fcfa(7 * c), icon: CalendarPlus, tone: "accent", state: "paid" },
    { day: "Dim", title: "Rien à payer", detail: "Le jour est déjà couvert par l’avance.", amount: fcfa(0), icon: ShieldCheck, tone: "ok", state: "paid" },
  ];

  const figures = [
    { value: c.toLocaleString("fr-FR"), unit: "FCFA", label: "de cotisation par jour" },
    { value: p.toLocaleString("fr-FR"), unit: "FCFA", label: "de pénalité par jour de retard" },
    { value: "365", unit: "jours", label: "payables d’avance en une fois" },
    { value: "0", unit: "FCFA", label: "pour s’inscrire" },
  ];

  const faq = [
    { question: "Comment payer ma cotisation ?", answer: "Depuis votre espace, choisissez le nombre de jours puis payez par Mobile Money sur la page sécurisée SasPay. Votre compte est crédité dès la confirmation, avec un reçu PDF." },
    { question: "Que se passe-t-il si je paie en retard ?", answer: p > 0 ? `Une pénalité de ${fcfa(p)} s’ajoute chaque jour où au moins une cotisation reste impayée. Elle ne se cumule pas par jour manqué.` : "Aucune pénalité n’est appliquée actuellement, mais les jours impayés restent dus." },
    { question: "Puis-je payer plusieurs jours d’avance ?", answer: "Oui, jusqu’à 365 jours. Les jours payés s’ajoutent après le dernier jour déjà couvert : rien n’est jamais payé deux fois." },
    { question: "Et si je dois faire une pause ?", answer: "L’administrateur peut mettre votre compte en pause. Aucune cotisation ni pénalité ne court pendant cette période." },
    { question: "J’ai oublié mon mot de passe.", answer: "Demandez un mot de passe temporaire à l’administrateur, puis choisissez-en un nouveau depuis votre profil." },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Bandeau : le téléphone sort du cercle de la tontine */}
      <div className="brand-hero overflow-hidden rounded-b-[2.25rem] sm:rounded-b-[3rem]">
        <SiteHeader onBrand />
        <section className="mx-auto max-w-6xl px-5 pt-8 sm:px-8 md:grid md:grid-cols-[1fr_1fr] md:items-center md:gap-6 md:pt-10">
          <div className="md:pb-24">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-maryx-ice">
              <span className="h-1.5 w-1.5 rounded-full bg-maryx-cyan" />
              Tontine journalière, {fcfa(c)} par jour
            </p>
            <h1 className="mt-5 max-w-[12ch] text-[2.75rem] leading-[1.02] font-bold text-white sm:text-[4.25rem]">
              Chaque jour compte dans le cercle.
            </h1>
            <p className="mt-5 max-w-[40ch] text-[1.05rem] leading-relaxed text-maryx-ice/80">
              Cotisez depuis votre téléphone, voyez vos jours se remplir et gardez un reçu de chaque franc versé.
            </p>
            <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
              <Link href="/auth/signup" className="inline-flex min-h-13 items-center justify-center rounded-full bg-maryx-cyan px-7 font-semibold text-maryx-navy hover:bg-white">
                Rejoindre la tontine
              </Link>
              <Link href="/auth/signin" className="inline-flex min-h-13 items-center justify-center rounded-full border border-white/20 px-7 font-semibold text-white hover:bg-white/10">
                Se connecter
              </Link>
            </div>
          </div>

          <div className="relative mx-auto mt-12 h-[27rem] w-full max-w-[26rem] sm:h-[31rem] md:mt-0">
            <ContributionRing
              days={MONTH}
              stagger={26}
              thickness={6}
              title="Un mois dans le cercle : 23 jours cotisés sur 30"
              className="absolute top-0 left-1/2 w-[min(100%,26rem)] -translate-x-1/2"
            />
            <div className="absolute top-[4.5rem] left-1/2 -translate-x-1/2 sm:top-[5rem]">
              <PhonePreview dailyContribution={c} />
            </div>
          </div>
        </section>
      </div>

      <main className="flex-1">
        <ul className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-6 gap-y-3 px-5 pt-8 text-sm text-muted sm:px-8">
          {[
            { icon: Smartphone, label: "Mobile Money via SasPay" },
            { icon: FileCheck2, label: "Reçu PDF à chaque paiement" },
            { icon: LockKeyhole, label: "Espace personnel protégé" },
          ].map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-accent" strokeWidth={2.2} />
              {label}
            </li>
          ))}
        </ul>

        {/* Une semaine dans le cercle : les règles racontées avec de vrais montants */}
        <section className="mx-auto max-w-6xl px-5 pt-20 sm:px-8 md:grid md:grid-cols-[0.85fr_1.15fr] md:gap-14 md:pt-28">
          <div className="md:sticky md:top-10 md:self-start">
            <h2 className="max-w-[14ch] text-[2rem] leading-[1.08] font-semibold text-heading sm:text-5xl">Une semaine dans le cercle.</h2>
            <p className="mt-4 max-w-[38ch] leading-relaxed text-muted">
              Un oubli, une pénalité, une régularisation, une avance : voici exactement ce que MARYX calcule pour vous.
            </p>
            <div className="mt-7 flex items-center gap-1.5" aria-hidden>
              {week.map((day) => (
                <span key={day.day} className={`h-2 flex-1 rounded-full ${day.state === "unpaid" ? "bg-bad" : "bg-accent"}`} />
              ))}
            </div>
          </div>

          <ol className="relative mt-10 md:mt-0">
            <span className="absolute top-5 bottom-5 left-[1.2rem] w-px bg-line-strong" aria-hidden />
            {week.map((day) => (
              <li key={day.day} className="relative flex gap-4 pb-7 last:pb-0">
                <IconChip icon={day.icon} tone={day.tone} className="relative ring-4 ring-bg" />
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-semibold text-ink">
                      <span className="mr-2 text-sm font-medium text-muted">{day.day}</span>
                      {day.title}
                    </p>
                    <p className={`shrink-0 font-display text-sm font-semibold tabular ${day.tone === "bad" ? "text-bad" : day.tone === "warn" ? "text-warn" : "text-ink"}`}>{day.amount}</p>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{day.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Les règles, en chiffres */}
        <section className="mx-auto max-w-6xl px-5 pt-24 sm:px-8 md:pt-32">
          <dl className="grid grid-cols-2 border-t border-line md:grid-cols-4">
            {figures.map((figure, index) => (
              <div key={figure.label} className={`border-b border-line py-7 pr-4 md:border-b-0 md:py-9 ${index % 2 === 1 ? "pl-5 border-l md:pl-6" : index === 2 ? "md:border-l md:pl-6" : ""}`}>
                <dt className="sr-only">{figure.label}</dt>
                <dd>
                  <span className="font-display text-[2.6rem] leading-none font-bold text-heading tabular sm:text-6xl">{figure.value}</span>
                  <span className="ml-1.5 text-sm font-semibold text-muted">{figure.unit}</span>
                  <span className="mt-2.5 block text-sm text-muted">{figure.label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Questions fréquentes */}
        <section className="mx-auto max-w-6xl px-5 pt-24 pb-20 sm:px-8 md:grid md:grid-cols-[0.85fr_1.15fr] md:gap-14 md:pt-32">
          <div>
            <h2 className="text-[2rem] leading-[1.08] font-semibold text-heading sm:text-5xl">Questions fréquentes</h2>
            <p className="mt-4 max-w-[34ch] text-muted">
              Une autre question ? Contactez l’administrateur de votre tontine.
            </p>
          </div>
          <div className="mt-8 divide-y divide-line border-y border-line md:mt-0">
            {faq.map((item) => (
              <details key={item.question} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-medium text-ink [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-strong text-muted transition-transform duration-200 group-open:rotate-45 group-open:border-accent group-open:text-accent">
                    <Plus className="h-4 w-4" />
                  </span>
                </summary>
                <p className="max-w-[60ch] pb-5 text-sm leading-relaxed text-muted">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
