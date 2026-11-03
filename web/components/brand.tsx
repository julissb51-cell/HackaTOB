import Link from "next/link";

/** Logo "Enlaza" del encabezado. */
export function Brand() {
  return (
    <Link href="/" className="font-display text-2xl font-medium tracking-tight">
      Enlaza
    </Link>
  );
}
