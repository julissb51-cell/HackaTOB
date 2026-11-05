"use client";

import { LogoMark, Wordmark } from "./brand";
import { useCopy } from "./language";
import { Symbol } from "./symbol";

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function Landing() {
  const t = useCopy();
  const features = [
    { icon: "groups", title: t.feat1Title, body: t.feat1Body },
    { icon: "notifications_active", title: t.feat2Title, body: t.feat2Body },
    { icon: "extension", title: t.feat3Title, body: t.feat3Body },
  ];
  return (
    <div className="flex flex-1 flex-col justify-center py-10 sm:py-16">
      <section className="flex flex-col items-center text-center">
        <div className="flex items-center gap-4">
          <LogoMark className="h-16 w-auto sm:h-20" />
          <Wordmark className="h-12 w-auto sm:h-[60px]" />
        </div>
        <p className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-[13px] font-medium text-link">
          <Symbol name="hub" className="text-[16px]" />
          {t.landingKicker}
        </p>
        <h1 className="motion-enter mt-5 max-w-3xl text-[40px] leading-[1.05] font-[650] tracking-[-1.5px] sm:text-[64px] sm:tracking-[-2.5px]">
          {t.landingTitle}
        </h1>
        <p className="motion-enter motion-enter-2 mt-5 max-w-xl text-lg leading-8 text-muted sm:text-xl">{t.landingLead}</p>
        <a
          href="/auth/login?next=/rooms"
          className="mt-9 inline-flex h-12 w-full max-w-xs items-center justify-center gap-3 rounded-full border border-line bg-surface px-6 text-[15px] font-semibold text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,180,216,0.12)] motion-btn motion-soft hover:border-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link motion-enter motion-enter-3 sm:w-auto"
        >
          <GoogleG />
          {t.signIn}
        </a>
        <p className="mt-4 text-sm text-muted">{t.landingNote}</p>
      </section>
      <section aria-label={t.featuresLabel} className="mt-16 grid gap-3 sm:mt-20 sm:grid-cols-3 sm:gap-4">
        {features.map((f) => (
          <div key={f.icon} className="motion-card rounded-3xl border border-line bg-surface/80 p-6 backdrop-blur-sm hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--line))]">
            <span className="grid size-11 place-items-center rounded-2xl bg-accent/15 text-link">
              <Symbol name={f.icon} className="text-[24px]" />
            </span>
            <h2 className="mt-4 text-[17px] font-semibold tracking-[-0.2px]">{f.title}</h2>
            <p className="mt-1.5 text-[15px] leading-6 text-muted">{f.body}</p>
          </div>
        ))}
      </section>
      <section aria-label={t.valueLabel} className="mx-auto mt-8 w-full max-w-3xl rounded-3xl border border-line bg-surface/80 px-6 py-5 backdrop-blur-sm sm:px-8">
        <div className="grid gap-4 text-left sm:grid-cols-2 sm:gap-8">
          <div>
            <h2 className="text-[13px] font-medium text-link">{t.valueWhoLabel}</h2>
            <p className="mt-1.5 text-[15px] leading-6">{t.valueWho}</p>
          </div>
          <div>
            <h2 className="text-[13px] font-medium text-link">{t.valuePlanLabel}</h2>
            <p className="mt-1.5 text-[15px] leading-6 text-muted">{t.valuePlan}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
