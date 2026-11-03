"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCopy } from "./language";
import { primaryButton } from "./styles";

export function RedirectNotice({ code, href }: { code: "login" | "join"; href: string }) {
  const text = useCopy();
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => router.replace(href), 2500);
    return () => window.clearTimeout(timer);
  }, [href, router]);

  const message = code === "login" ? text.signInRoom : text.notMember;
  const action = code === "login" ? text.signIn : text.goJoin;

  return (
    <section className="space-y-6">
      <p role="status" className="text-lg leading-7">
        {message}
      </p>
      <a href={href} className={primaryButton}>
        {action}
      </a>
    </section>
  );
}
