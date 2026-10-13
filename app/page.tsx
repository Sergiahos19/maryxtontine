import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  Briefcase,
  Eye,
  EyeOff,
  Hammer,
  KeyRound,
  LockKeyhole,
  PartyPopper,
  Plus,
  ReceiptText,
  Scale,
  ScrollText,
  ShieldCheck,
  Smartphone,
  Store,
} from "lucide-react";

import { Footer } from "@/components/layout/footer";
import { SiteHeader } from "@/components/layout/site-header";

// Photos : Pexels, licence libre (Werner Pfennig, PICHA Stock, Victor Oluwayoju).

const trust = [
  { icon: Smartphone, label: "Paiement Mobile Money via SasPay" },
  { icon: ReceiptText, label: "Un reçu pour chaque versement" },
  { icon: ScrollText, label: "Les mêmes règles pour tous" },
  { icon: LockKeyhole, label: "Espace personnel protégé" },
];

const steps = [
  { title: "Formez le cercle", text: "Chaque membre crée son compte avec sa photo. Le groupe se retrouve dans un espace commun." },
  { title: "L’administrateur fixe les règles", text: "Il définit la cotisation journalière et les pénalités de retard. Elles s’appliquent à tous, automatiquement." },
  { title: "Chacun cotise chaque jour", text: "Depuis son téléphone, par Mobile Money, pour la journée ou plusieurs jours d’avance." },
  { title: "Le groupe suit la caisse", text: "Jours payés, retards, reçus : tout est visible, sans cahier ni calculs à la main." },
];

const reasons = [
  { icon: Eye, title: "Tout est transparent", text: "Chaque membre sait où en est le groupe : qui est à jour, qui doit régulariser. Plus de doutes ni de discussions sur les comptes." },
  { icon: Scale, title: "Les mêmes règles pour tous", text: "L’administrateur fixe la cotisation journalière et les pénalités de retard. Elles s’appliquent à chacun, sans exception ni oubli." },
  { icon: Smartphone, title: "Un simple téléphone suffit", text: "On cotise par Mobile Money, où que l’on soit. Pas de rendez-vous, pas d’argent liquide à transporter." },
  { icon: ReceiptText, title: "Une trace de chaque franc", text: "Chaque versement donne droit à un reçu, et chacun peut télécharger son relevé complet quand il le souhaite." },
];

const security = [
  { icon: BadgeCheck, title: "Paiements vérifiés", text: "Un versement n’est crédité qu’après confirmation par SasPay, jamais sur simple retour du navigateur." },
  { icon: KeyRound, title: "Comptes sécurisés", text: "Mots de passe chiffrés et connexions bloquées après des tentatives répétées." },
  { icon: EyeOff, title: "Discrétion entre membres", text: "Les photos et situations ne sont visibles que par les membres connectés. Emails et téléphones restent privés." },
];

const goals = [
  { icon: Briefcase, label: "Lancer une entreprise" },
  { icon: Store, label: "Ouvrir un commerce" },
  { icon: Hammer, label: "Équiper un atelier" },
  { icon: PartyPopper, label: "Préparer un événement" },
];

const faq = [
  { question: "Comment payer ma cotisation ?", answer: "Depuis votre espace, choisissez le nombre de jours puis payez par Mobile Money sur la page sécurisée SasPay. Votre compte est crédité dès la confirmation, avec un reçu PDF." },
  { question: "Que se passe-t-il si je paie en retard ?", answer: "Une pénalité, fixée par l’administrateur, s’ajoute chaque jour où au moins une cotisation reste impayée. Elle ne se cumule pas par jour manqué." },
  { question: "Puis-je payer plusieurs jours d’avance ?", answer: "Oui, jusqu’à 365 jours. Les jours payés s’ajoutent après le dernier jour déjà couvert : rien n’est jamais payé deux fois." },
  { question: "Les autres membres voient-ils mes informations ?", answer: "Ils voient votre nom, votre photo et si vous êtes à jour. Votre email et votre numéro de téléphone restent privés." },
  { question: "Et si je dois faire une pause ?", answer: "L’administrateur peut mettre votre compte en pause. Aucune cotisation ni pénalité ne court pendant cette période." },
  { question: "J’ai oublié mon mot de passe.", answer: "Demandez un mot de passe temporaire à l’administrateur, puis choisissez-en un nouveau depuis votre profil." },
];

function SectionTitle({ title, text }: { title: string; text?: string }) {
  return (
    <div className="max-w-2xl">
      <h2 className="text-[2rem] leading-[1.08] font-semibold text-heading sm:text-[2.75rem]">{title}</h2>
      {text ? <p className="mt-4 max-w-[52ch] text-[1.05rem] leading-relaxed text-muted">{text}</p> : null}
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* 1. Accroche */}
      <div className="brand-hero overflow-hidden rounded-b-[2.25rem] sm:rounded-b-[3rem]">
        <SiteHeader onBrand />
        <section className="mx-auto max-w-6xl px-5 pt-8 pb-14 sm:px-8 md:grid md:grid-cols-[1.05fr_0.95fr] md:items-center md:gap-12 md:pt-12 md:pb-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-maryx-ice">
              <span className="h-1.5 w-1.5 rounded-full bg-maryx-cyan" />
              Tontine en ligne
            </p>
            <h1 className="mt-5 max-w-[13ch] text-[2.75rem] leading-[1.02] font-bold text-white sm:text-[4.25rem]">
              Cotisez ensemble. Réalisez vos projets.
            </h1>
            <p className="mt-5 max-w-[42ch] text-[1.05rem] leading-relaxed text-maryx-ice/80">
              MARYX réunit votre groupe autour d’une caisse commune. Chacun cotise chaque jour depuis son téléphone, et tout le monde voit le cercle avancer.
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

          <div className="relative mx-auto mt-12 w-full max-w-[30rem] md:mt-0">
            <div className="relative aspect-[5/4] overflow-hidden rounded-[2rem] ring-1 ring-white/15 shadow-[var(--shadow-float)] md:aspect-[4/5]">
              <Image
                src="/images/hero-groupe.jpg"
                alt="Deux membres de la tontine regardent ensemble leur espace MARYX sur un téléphone."
                fill
                priority
                sizes="(min-width: 768px) 480px, 100vw"
                className="object-cover object-[45%_50%]"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-maryx-navy/55 via-transparent to-transparent" aria-hidden />
            </div>

          </div>
        </section>
      </div>

      <main className="flex-1">
        {/* 2. Garanties */}
        <section className="mx-auto max-w-6xl px-5 pt-10 sm:px-8">
          <ul className="grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-4">
            {trust.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm text-ink">
                <Icon className="h-5 w-5 shrink-0 text-accent" strokeWidth={2} />
                {label}
              </li>
            ))}
          </ul>
        </section>

        {/* 3. Comment ça marche */}
        <section className="mx-auto max-w-6xl px-5 pt-24 sm:px-8 md:pt-32">
          <SectionTitle title="Quatre étapes, un seul cercle." text="Une tontine comme vous la connaissez, sans le cahier, les relances au téléphone ni les comptes à refaire." />
          <ol className="mt-12 grid gap-8 md:grid-cols-4 md:gap-6">
            {steps.map((step, index) => (
              <li key={step.title} className="relative md:pt-14">
                <span className="hidden md:absolute md:top-5 md:right-0 md:left-12 md:block md:h-px md:bg-line-strong" aria-hidden />
                <div className="flex gap-4 md:block">
                  <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent font-display text-sm font-semibold text-accent-ink tabular md:absolute md:top-0">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-ink">{step.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.text}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* 4. Pourquoi MARYX */}
        <section className="mx-auto max-w-6xl px-5 pt-24 sm:px-8 md:grid md:grid-cols-[0.8fr_1.2fr] md:gap-16 md:pt-32">
          <div className="md:sticky md:top-12 md:self-start">
            <SectionTitle
              title="Pourquoi les groupes choisissent MARYX."
              text="Une tontine tient sur la confiance. MARYX la rend simple à garder, jour après jour, pour tous les membres."
            />
          </div>
          <ul className="mt-12 grid gap-x-10 sm:grid-cols-2 md:mt-0">
            {reasons.map(({ icon: Icon, title, text }) => (
              <li key={title} className="border-t border-line py-8">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                  <Icon className="h-6 w-6" strokeWidth={1.8} />
                </span>
                <h3 className="mt-5 text-xl font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* 5. Objectif commun */}
        <section className="mx-auto max-w-6xl px-5 pt-24 sm:px-8 md:grid md:grid-cols-2 md:items-center md:gap-14 md:pt-32">
          <div className="relative pb-16 sm:pb-20">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem]">
              <Image
                src="/images/objectif-projet.jpg"
                alt="Trois associées préparent ensemble leur projet d’entreprise."
                fill
                sizes="(min-width: 768px) 540px, 100vw"
                className="object-cover"
              />
            </div>
            <div className="absolute right-4 bottom-0 w-[44%] overflow-hidden rounded-[1.5rem] ring-8 ring-bg sm:right-6">
              <div className="relative aspect-square">
                <Image src="/images/commerce.jpg" alt="Une commerçante devant son étal au marché." fill sizes="240px" className="object-cover object-[70%_40%]" />
              </div>
            </div>
          </div>
          <div className="mt-6 md:mt-0">
            <SectionTitle
              title="Un projet commun, financé jour après jour."
              text="Seul, il faut des années pour réunir un capital. Ensemble, de petites cotisations régulières deviennent la mise de départ du groupe. MARYX garde la caisse lisible pour tous, du premier jour jusqu’au projet."
            />
            <ul className="mt-8 grid grid-cols-2 gap-3">
              {goals.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3.5 text-sm font-medium text-ink">
                  <Icon className="h-5 w-5 shrink-0 text-accent" strokeWidth={2} />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 6. Sécurité */}
        <section className="mx-auto max-w-6xl px-5 pt-24 sm:px-8 md:pt-32">
          <div className="brand-card relative overflow-hidden px-7 py-12 sm:px-12 sm:py-16">
            {/* Anneaux concentriques décoratifs : l’écho du cercle de la tontine. */}
            <svg className="pointer-events-none absolute -top-40 -right-40 h-[34rem] w-[34rem] text-maryx-ice/10" viewBox="0 0 200 200" fill="none" aria-hidden>
              {[96, 78, 60, 42].map((radius) => (
                <circle key={radius} cx="100" cy="100" r={radius} stroke="currentColor" strokeWidth="0.6" />
              ))}
            </svg>
            <div className="relative max-w-xl">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-maryx-cyan">
                <ShieldCheck className="h-6 w-6" strokeWidth={1.8} />
              </span>
              <h2 className="mt-6 text-[2rem] leading-[1.1] font-semibold sm:text-[2.75rem]">Votre caisse, protégée à chaque étape.</h2>
              <p className="brand-muted mt-4 max-w-[46ch] leading-relaxed">La sécurité de l’argent commun passe avant tout : chaque versement est contrôlé, chaque compte est protégé.</p>
            </div>
            <ul className="relative mt-12 grid gap-4 md:grid-cols-3">
              {security.map(({ icon: Icon, title, text }) => (
                <li key={title} className="rounded-3xl border border-white/12 bg-white/[0.04] p-6 backdrop-blur-sm">
                  <Icon className="h-6 w-6 text-maryx-cyan" strokeWidth={1.8} />
                  <p className="mt-4 text-lg font-semibold">{title}</p>
                  <p className="brand-muted mt-2 text-sm leading-relaxed">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 7. Questions fréquentes */}
        <section className="mx-auto max-w-6xl px-5 pt-24 sm:px-8 md:grid md:grid-cols-[0.85fr_1.15fr] md:gap-14 md:pt-32">
          <div>
            <h2 className="text-[2rem] leading-[1.08] font-semibold text-heading sm:text-[2.75rem]">Questions fréquentes</h2>
            <p className="mt-4 max-w-[34ch] text-muted">Une autre question ? Contactez l’administrateur de votre tontine.</p>
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

        {/* 8. Dernier appel */}
        <section className="mx-auto max-w-6xl px-5 pt-24 pb-20 sm:px-8 md:pt-32">
          <div className="brand-hero relative overflow-hidden rounded-[2rem] px-7 py-12 text-center sm:px-12 sm:py-16">
            <h2 className="mx-auto max-w-[18ch] text-[2rem] leading-[1.1] font-semibold text-white sm:text-[2.75rem]">Votre cercle commence aujourd’hui.</h2>
            <p className="mx-auto mt-4 max-w-[42ch] text-maryx-ice/80">Créez votre compte en deux minutes et rejoignez la caisse commune de votre groupe.</p>
            <div className="mt-8 flex flex-col justify-center gap-2.5 sm:flex-row">
              <Link href="/auth/signup" className="inline-flex min-h-13 items-center justify-center rounded-full bg-maryx-cyan px-7 font-semibold text-maryx-navy hover:bg-white">
                Rejoindre la tontine
              </Link>
              <Link href="/auth/signin" className="inline-flex min-h-13 items-center justify-center rounded-full border border-white/20 px-7 font-semibold text-white hover:bg-white/10">
                Se connecter
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
