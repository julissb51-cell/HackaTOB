import Link from "next/link";

/** Marca de Enlaza: nido de tejedor (silueta sólida + entrada cian). Colores por variables CSS para el modo oscuro. */
export function LogoMark({ className = "h-8 w-auto" }: { className?: string }) {
  return (
    <svg viewBox="14 5 72 88" className={className} aria-hidden="true">
      <path d="M18 10 H82" stroke="var(--logo-ink)" strokeWidth="6" strokeLinecap="round" />
      <path d="M50 10 V18" stroke="var(--logo-ink)" strokeWidth="6" />
      <path d="M50 16 C72 16 84 40 80 62 C76 82 64 90 50 90 C36 90 24 82 20 62 C16 40 28 16 50 16Z" fill="var(--logo-ink)" />
      <circle cx="50" cy="70" r="13" fill="var(--logo-accent)" />
    </svg>
  );
}

/** Logo "Enlaza" del encabezado. Con `mark` muestra la marca (nido) (barra superior). */
export function Brand({ mark = false }: { mark?: boolean }) {
  if (!mark)
    return (
      <Link href="/" className="font-display text-2xl font-medium tracking-tight">
        Enlaza
      </Link>
    );
  return (
    <Link href="/" className="flex items-center gap-2.5 text-[19px] font-[650] tracking-[-0.3px]">
      <LogoMark />
      Enlaza
    </Link>
  );
}
