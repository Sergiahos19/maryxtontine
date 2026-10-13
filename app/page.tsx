import Link from "next/link";
import { Activity, ArrowRight, Lock, ShieldCheck, Users } from "lucide-react";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Header />

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Badge tone="info">Gestion des cotisations MARYX</Badge>
            <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Une gestion claire, sécurisée et transparente de la tontine MARYX.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-300">
              Consultez votre espace de cotisation et gérez les données enregistrées avec des accès adaptés aux membres et à l’administration.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link href="/auth/signin">
                <Button variant="primary">Se connecter</Button>
              </Link>
              <Link href="/auth/signup">
                <Button variant="secondary">Créer un compte</Button>
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-cyan-400/20 bg-slate-900/70 p-6 shadow-[0_0_60px_rgba(34,211,238,0.25)] backdrop-blur">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm text-slate-400">Espace membre</span>
                  <Users className="h-4 w-4 text-cyan-300" />
                </div>
                <div className="text-2xl font-semibold text-white">Personnel</div>
                <div className="mt-2 text-xs text-slate-400">Accès après connexion</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                <div className="text-lg font-semibold text-white">Vos informations, sans statistiques préremplies</div>
                <p className="mt-2 text-sm text-slate-400">Les relevés et soldes sont affichés à partir des données enregistrées dans votre compte.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Fonctionnalités</p>
          <h2 className="mt-3 text-3xl font-semibold text-white">Un espace pensé pour la confiance collective</h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {[
            { icon: Activity, title: "Suivi des cotisations", text: "Consultez les montants et mouvements enregistrés dans votre compte." },
            { icon: ShieldCheck, title: "Accès par rôle", text: "Les espaces membre et administration sont contrôlés par le compte connecté." },
            { icon: Lock, title: "Données centralisées", text: "Les informations du compte sont stockées dans la base de données configurée." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-semibold text-white">{title}</h3>
              <p className="mt-3 text-slate-300">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-white/10 bg-gradient-to-r from-slate-900 to-slate-800 p-8 sm:p-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Prêt à lancer</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">Centralisez votre tontine avec MARYX</h2>
            </div>
            <Link href="/auth/signin">
              <Button variant="primary" className="gap-2">
                Accéder au dashboard <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
