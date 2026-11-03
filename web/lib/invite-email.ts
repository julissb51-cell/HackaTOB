/** Validación y límite de envíos para "Invitar por correo" (sin dependencias de servidor). */
const EMAIL = /^[^\s@<>()",;:]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export function isEmail(value: string): boolean {
  return value.length <= 254 && EMAIL.test(value);
}

/** Ventana deslizante en memoria: como mucho `max` envíos por clave cada `windowMs`. */
export function createRateLimiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string, now = Date.now()): boolean => {
    const recent = (hits.get(key) ?? []).filter((at) => now - at < windowMs);
    if (recent.length >= max) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    return true;
  };
}

export function inviteEmailText(lang: "es" | "en", inviter: string, topic: string, url: string) {
  return lang === "en"
    ? {
        subject: `${inviter} invited you to "${topic}" on Enlaza`,
        text: `${inviter} invited you to the room "${topic}" on Enlaza.\n\nJoin here: ${url}\n\nIf you weren't expecting this, you can ignore this email.`,
      }
    : {
        subject: `${inviter} te invitó a «${topic}» en Enlaza`,
        text: `${inviter} te invitó a la sala «${topic}» en Enlaza.\n\nÚnete aquí: ${url}\n\nSi no esperabas este correo, puedes ignorarlo.`,
      };
}
