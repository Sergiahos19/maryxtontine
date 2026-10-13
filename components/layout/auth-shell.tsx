import Link from "next/link";

import { BrandMark } from "@/components/layout/brand-mark";
import { ThemeToggle } from "@/components/layout/theme-toggle";

type AuthShellProps = {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 [background:var(--wash)] [mask-image:linear-gradient(to_bottom,black_30%,transparent)]" aria-hidden />
      <header className="relative mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <BrandMark />
        <ThemeToggle />
      </header>
      <main className="relative flex flex-1 items-start justify-center px-4 pt-6 pb-12 sm:items-center sm:pt-0">
        <div className="w-full max-w-md sm:card sm:p-8">
          <h1 className="text-3xl font-semibold text-heading">{title}</h1>
          {description ? <p className="mt-2 text-muted">{description}</p> : null}
          <div className="mt-7">{children}</div>
          {footer ? <div className="mt-8 border-t border-line pt-5 text-sm text-muted">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="font-medium text-accent hover:underline">{children}</Link>;
}
