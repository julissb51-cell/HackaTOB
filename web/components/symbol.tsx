/** Icono de Material Symbols Rounded (la fuente la carga FusionRoot). */
export function Symbol({ name, className = "text-[22px]" }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`m-symbol ${className}`}>
      {name}
    </span>
  );
}

const pillBase =
  "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-[22px] text-[15px] font-semibold tracking-[0.2px] transition active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link disabled:cursor-wait disabled:opacity-70";
export const pillPrimary = `${pillBase} bg-accent text-accent-ink hover:bg-accent-hover`;
export const pillSecondary = `${pillBase} bg-structural text-foreground hover:bg-line`;
export const iconButton =
  "grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-muted transition-colors hover:bg-structural hover:text-foreground focus-visible:outline-2 focus-visible:outline-link";
