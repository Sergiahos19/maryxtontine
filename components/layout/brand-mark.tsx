import Image from "next/image";
import Link from "next/link";

export function BrandMark({ href = "/", textClassName = "text-heading" }: { href?: string; textClassName?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-full" aria-label="MARYX, accueil">
      <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl">
        <Image src="/images/maryxok.jpeg" alt="" fill sizes="36px" className="scale-[1.35] object-cover" priority />
      </span>
      <span className={`font-display text-[1.05rem] font-semibold tracking-[0.18em] ${textClassName}`}>MARYX</span>
    </Link>
  );
}
