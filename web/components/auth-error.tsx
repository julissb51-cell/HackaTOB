"use client";

import Link from "next/link";
import { useCopy } from "./language";
import { secondaryButton } from "./styles";

export function AuthError({ reason }: { reason: "config" | "oauth" }) {
  const text = useCopy();
  return (
    <section className="space-y-6">
      <p role="alert" className="text-lg">
        {reason === "config" ? text.configError : text.oauthError}
      </p>
      <Link href="/" className={secondaryButton}>
        {text.back}
      </Link>
    </section>
  );
}
