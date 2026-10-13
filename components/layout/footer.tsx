import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-white/10 bg-slate-950/90">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 text-sm text-slate-300 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div>
          <div className="mb-3 text-lg font-semibold tracking-[0.25em] text-white">MARYX</div>
          <p className="max-w-xs text-slate-400">
            Gestion des cotisations et suivi des paiements.
          </p>
        </div>
        <div>
          <div className="mb-3 text-white">Navigation</div>
          <ul className="space-y-2 text-slate-400">
            <li><Link href="/dashboard" className="hover:text-cyan-300">Tableau de bord</Link></li>
            <li><Link href="/dashboard/members" className="hover:text-cyan-300">Membres</Link></li>
            <li><Link href="/history" className="hover:text-cyan-300">Historique</Link></li>
          </ul>
        </div>
        <div>
          <div className="mb-3 text-white">Sécurité</div>
          <ul className="space-y-2 text-slate-400">
            <li>Connexion par compte</li>
            <li>Données associées au compte</li>
            <li>Accès administrateur contrôlé</li>
          </ul>
        </div>
        <div>
          <div className="mb-3 text-white">Support</div>
          <ul className="space-y-2 text-slate-400">
            <li>Pour assistance, contactez l’administrateur MARYX.</li>
          </ul>
        </div>
      </div>
      <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:px-6 lg:px-8">
        <span>© 2026 MARYX</span>
        <a
          href="https://sergiahos.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-sm text-slate-400 transition-colors hover:text-cyan-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
        >
          Réalisé par <span className="font-semibold text-slate-200">Sergiahos</span>
        </a>
      </div>
    </footer>
  );
}
