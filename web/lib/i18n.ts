export const LANGS = ["es", "en"] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_STORAGE_KEY = "enlaza.lang";
export const LANG_COOKIE = "enlaza_lang";

export function parseLang(value: string | null | undefined): Lang {
  return value === "en" ? "en" : "es";
}

export function langFromCookieHeader(header: string | null | undefined): Lang | null {
  if (!header) return null;
  const match = header.match(/(?:^|;\s*)enlaza_lang=(es|en)(?:\s*;|$)/);
  return match ? parseLang(match[1]) : null;
}

export function langCookie(lang: Lang, secure: boolean): string {
  const base = `${LANG_COOKIE}=${lang}; Path=/; Max-Age=31536000; SameSite=Lax`;
  return secure ? `${base}; Secure` : base;
}
