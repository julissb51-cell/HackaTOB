"use client";

import Link from "next/link";
import { NO_DATE } from "@/lib/room-fields";
import { CopyValue, InviteLink, RememberToken } from "./invite-link";
import { useCopy } from "./language";
import { secondaryButton } from "./styles";

export type RoomView = {
  id: string;
  topic: string;
  dueDate: string | null;
  parts: string[];
  token: string;
  path: string;
  members: { name: string; part: string | null }[];
};

export function RoomScreen({ room }: { room: RoomView }) {
  const text = useCopy();
  const due = !room.dueDate || room.dueDate === NO_DATE ? text.noDate : room.dueDate;

  return (
    <section className="space-y-8">
      <RememberToken roomId={room.id} token={room.token} />
      <div>
        <p className="text-sm font-semibold tracking-[0.16em] text-accent uppercase">{due}</p>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight">{room.topic}</h1>
      </div>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-[0.14em] text-muted uppercase">{text.members}</h2>
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {room.members.map((member, index) => (
            <li key={`${member.name}-${index}`} className="flex items-baseline justify-between gap-4 px-4 py-3">
              <span className="font-semibold">{member.name}</span>
              <span className="text-right text-sm text-muted">{member.part ?? text.memberPart}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-[0.14em] text-muted uppercase">{text.parts}</h2>
        {room.parts.length === 0 ? (
          <p className="text-sm text-muted">{text.partsEmpty}</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {room.parts.map((part) => (
              <li key={part}>{part}</li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-4 rounded-2xl border border-line bg-surface/70 p-4">
        <h2 className="text-sm font-semibold tracking-[0.14em] text-accent uppercase">{text.extension}</h2>
        <p className="text-sm leading-6 text-muted">{text.extensionHelp}</p>
        <InviteLink path={room.path} />
        <CopyValue id="room-id" label={text.idLabel} value={room.id} />
        <CopyValue id="room-token" label={text.tokenLabel} value={room.token} />
        <p className="text-sm leading-6 text-muted">{text.tokenHelp}</p>
      </section>
      <p className="text-sm leading-6 text-muted">{text.later}</p>
      <Link href="/" className={secondaryButton}>
        {text.back}
      </Link>
    </section>
  );
}

export function RoomMessage({ code }: { code: "unavailable" | "save" }) {
  const text = useCopy();
  return (
    <section className="space-y-6">
      <p role="alert" className="text-lg">
        {code === "save" ? text.save : text.unavailable}
      </p>
      <Link href="/" className={secondaryButton}>
        {text.back}
      </Link>
    </section>
  );
}
