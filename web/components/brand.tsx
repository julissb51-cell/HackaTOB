import Link from "next/link";

/** Marca provisional de Enlaza (telaraña de nodos). Usa variables CSS para el modo oscuro. */
export function LogoMark({ className = "size-8" }: { className?: string }) {
  const spokes = [
    [512, 342],
    [673.7, 459.5],
    [611.9, 649.5],
    [412.1, 649.5],
    [350.3, 459.5],
  ];
  return (
    <svg viewBox="182 182 660 660" className={className} aria-hidden="true">
      <circle cx="512" cy="512" r="330" fill="var(--logo-bg)" />
      <g stroke="var(--logo-ink)" strokeWidth="22" strokeLinecap="round">
        <circle cx="512" cy="512" r="82" fill="none" />
        {spokes.map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <line x1="512" y1="512" x2={x} y2={y} />
            <circle cx={x} cy={y} r="26" fill="var(--logo-bg)" />
          </g>
        ))}
        <circle cx="512" cy="512" r="40" fill="var(--logo-bg)" />
      </g>
    </svg>
  );
}

/** Logo "Enlaza" del encabezado. Con `mark` muestra la marca provisional (solo en /rooms). */
export function Brand({ mark = false }: { mark?: boolean }) {
  if (!mark)
    return (
      <Link href="/" className="font-display text-2xl font-medium tracking-tight">
        Enlaza
      </Link>
    );
  return (
    <Link href="/" className="g-brand flex items-center gap-2.5 text-[22px] font-medium tracking-tight">
      <LogoMark />
      Enlaza
    </Link>
  );
}
