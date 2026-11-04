/** Lee un enlace de invitación pegado (URL completa o ruta) y devuelve la ruta interna /join/{id}?t={token}, o null. */
export function parseInviteLink(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value, "https://enlaza.local");
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol)) return null;
  const match = /^\/join\/([^/]+)\/?$/.exec(url.pathname);
  const token = url.searchParams.get("t")?.trim() ?? "";
  if (!match || !token) return null;
  let id: string;
  try {
    id = decodeURIComponent(match[1]).trim();
  } catch {
    return null;
  }
  if (!id) return null;
  return `/join/${encodeURIComponent(id)}?t=${encodeURIComponent(token)}`;
}
