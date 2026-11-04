"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { joinInviteAction } from "@/lib/room-actions";
import { invitePath, roomTokenStorageKey, type JoinErrorCode } from "@/lib/room-fields";
import { useCopy } from "./language";
import { primaryButton, secondaryButton } from "./styles";

export function AutoJoin({ roomId, token }: { roomId: string; token: string }) {
  const text = useCopy();
  const router = useRouter();
  const [code, setCode] = useState<JoinErrorCode | null>(null);

  useEffect(() => {
    let active = true;
    joinInviteAction(roomId, token)
      .then((result) => {
        if (!active) return;
        if (result.ok) {
          try {
            localStorage.setItem(roomTokenStorageKey(roomId), token);
          } catch {
            // El modo privado puede bloquear el almacenamiento.
          }
          router.replace(`/rooms/${roomId}`);
          return;
        }
        setCode(result.code);
      })
      .catch(() => {
        if (active) setCode("save");
      });
    return () => {
      active = false;
    };
  }, [roomId, token, router]);

  if (!code) return <p className="pt-10 text-lg">{text.joining}</p>;
  const loginHref = code === "auth" ? `/auth/login?next=${encodeURIComponent(invitePath(roomId, token))}` : undefined;
  return <JoinMessage code={code} loginHref={loginHref} />;
}

export function JoinMessage({ code, loginHref }: { code: JoinErrorCode; loginHref?: string }) {
  const text = useCopy();
  const message =
    code === "link" ? text.link : code === "token" ? text.tokenError : code === "auth" ? text.authError : text.joinSave;
  return (
    <section className="max-w-xl space-y-6 pt-10">
      <p role="alert" className="text-lg">
        {message}
      </p>
      <div className="flex flex-wrap gap-3">
        {loginHref ? (
          <a href={loginHref} className={primaryButton}>
            {text.signIn}
          </a>
        ) : null}
        <Link href="/" className={secondaryButton}>
          {text.back}
        </Link>
      </div>
    </section>
  );
}
