import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { RoomMessage, RoomScreen } from "@/components/room-screen";
import { ScreenFallback, Shell } from "@/components/shell";
import { currentAccount } from "@/lib/current-account";
import { readRoomForMember } from "@/lib/room-membership";
import { supabaseMembershipStore } from "@/lib/room-membership-db";
import { invitePath, parseRoomId } from "@/lib/room-fields";

type PageProps = { params: Promise<{ id: string }> };

export default function RoomPage(props: PageProps) {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <RoomContent params={props.params} />
    </Suspense>
  );
}

async function RoomContent({ params }: PageProps) {
  await connection();
  const id = parseRoomId((await params).id);
  const account = await currentAccount();
  if (!account) {
    redirect(`/auth/login?next=${encodeURIComponent(id ? `/rooms/${id}` : "/")}`);
  }
  if (!id) {
    return (
      <Shell signedIn>
        <RoomMessage code="unavailable" />
      </Shell>
    );
  }

  const view = await readRoomForMember(supabaseMembershipStore, account.id, id);
  if (!view.ok) {
    return (
      <Shell signedIn>
        <RoomMessage code={view.code === "save" ? "save" : "unavailable"} />
      </Shell>
    );
  }

  return (
    <Shell signedIn>
      <RoomScreen
        room={{
          id: view.room.id,
          topic: view.room.topic,
          dueDate: view.room.dueDate,
          parts: view.room.parts,
          token: view.room.token,
          path: invitePath(view.room.id, view.room.token),
          members: view.members.map((member) => ({ name: member.name, part: member.part })),
        }}
      />
    </Shell>
  );
}
