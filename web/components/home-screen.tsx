"use client";

import Link from "next/link";
import { useCopy } from "./language";
import { primaryButton } from "./styles";

export function HomeScreen({ signedIn, name }: { signedIn: boolean; name: string | null }) {
  const text = useCopy();

  return (
    <div className="flex flex-1 flex-col justify-center pb-16">
      <p className="text-sm font-semibold tracking-[0.16em] text-accent uppercase">{text.kicker}</p>
      <h1 className="mt-3 font-display text-5xl leading-none font-medium tracking-tight sm:text-7xl">Enlaza</h1>
      <p className="mt-6 max-w-md text-xl leading-8">{text.lead}</p>
      {signedIn && name ? (
        <p className="mt-4 text-sm text-muted">
          {text.hello} <span className="text-foreground">{name}</span>
        </p>
      ) : null}
      <div className="mt-8 [&>a]:w-full sm:[&>a]:w-auto">
        {signedIn ? (
          <Link href="/rooms/new" className={primaryButton}>
            {text.createRoom}
          </Link>
        ) : (
          <Link href="/auth/login?next=/rooms/new" className={primaryButton}>
            {text.signIn}
          </Link>
        )}
      </div>
      <p className="mt-8 border-t border-line pt-6 text-base leading-7 text-muted">
        {signedIn ? text.noteIn : text.noteOut}
      </p>
    </div>
  );
}
