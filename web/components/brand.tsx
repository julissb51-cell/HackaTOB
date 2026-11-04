import { WM_A, WM_DOT, WM_INK, WM_L, WM_TAIL, WM_TAIL_W, WM_VIEWBOX } from "./wordmark-paths";
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

/** Wordmark "Enlaza" (Original refinado): la "l" cian se curva y abraza la "a" por debajo; la cola pasa DETRÁS de la "a". */
export function Wordmark({ className = "h-[26px] w-auto" }: { className?: string }) {
  return (
    <svg viewBox={WM_VIEWBOX} className={className} role="img" aria-label="Enlaza">
      <path d={WM_INK} fill="var(--logo-ink)" />
      <path d={WM_L} fill="var(--logo-accent)" />
      <path d={WM_TAIL} fill="none" stroke="var(--logo-accent)" strokeWidth={WM_TAIL_W} />
      <circle cx={WM_DOT.cx} cy={WM_DOT.cy} r={WM_DOT.r} fill="var(--logo-accent)" />
      <path d={WM_A} fill="var(--logo-ink)" />
    </svg>
  );
}

/** Logo "Enlaza" del encabezado. Con `mark` muestra la marca (nido) (barra superior). */
export function Brand({ mark = false }: { mark?: boolean }) {
  return (
    <Link href="/" aria-label="Enlaza" className="flex items-center gap-2.5">
      {mark ? <LogoMark className="h-8 w-auto" /> : null}
      <Wordmark className="h-[26px] w-auto" />
    </Link>
  );
}
