/** "Invitar por correo": validación y enlaces mailto:/Gmail prellenados (sin servidor ni SMTP). */
const EMAIL = /^[^\s@<>()",;:]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export function isEmail(value: string): boolean {
  return value.length <= 254 && EMAIL.test(value);
}

export function inviteEmailText(lang: "es" | "en", topic: string, url: string) {
  return lang === "en"
    ? {
        subject: `Join my Enlaza room: ${topic}`,
        body: `Hi! I'd like you to join my Enlaza room "${topic}" so we can work on it together.\n\nJoin here: ${url}\n\nSee you there!`,
      }
    : {
        subject: `Te invito a mi sala de Enlaza: ${topic}`,
        body: `¡Hola! Me gustaría que te unas a mi sala de Enlaza «${topic}» para trabajar juntos.\n\nÚnete aquí: ${url}\n\n¡Nos vemos allí!`,
      };
}

export function mailtoHref(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to).replace(/%40/g, "@")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function gmailHref(to: string, subject: string, body: string): string {
  const q = new URLSearchParams({ view: "cm", fs: "1", to, su: subject, body });
  return `https://mail.google.com/mail/?${q.toString()}`;
}
