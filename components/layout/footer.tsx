import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© {new Date().getFullYear()} MARYX. Pour toute question, contactez l’administrateur de votre tontine.</p>
        <div className="flex items-center gap-5">
          <Link href="/auth/signin" className="hover:text-ink">Connexion</Link>
          <Link href="/auth/signup" className="hover:text-ink">Inscription</Link>
          <a href="https://sergiahos.vercel.app/" target="_blank" rel="noopener noreferrer" className="hover:text-ink">
            Réalisé par Sergiahos
          </a>
        </div>
      </div>
    </footer>
  );
}
