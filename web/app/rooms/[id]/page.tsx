import { AccountSlot } from "@/components/app-header";
import { Suspense } from "react";
import { FusionRoot } from "@/components/fusion-root";
import { after, connection } from "next/server";
import { RedirectNotice } from "@/components/redirect-notice";
import { RoomMessage, RoomScreen } from "@/components/room-screen";
import { ScreenFallback, Shell } from "@/components/shell";
import { toBoard } from "@/lib/board-view";
import { loadRoomBoard } from "@/lib/board";
import { currentAccount } from "@/lib/current-account";
import { sortEventsNewestFirst } from "@/lib/room-feed";
import { invitePath, parseRoomId } from "@/lib/room-fields";
import { readRoomForMember } from "@/lib/room-membership";
import { supabaseMembershipStore } from "@/lib/room-membership-db";
import { supabaseRoomStore } from "@/lib/room-store";
import type { StoredEvent } from "@/lib/room-types";
import { trackAnalysis } from "@/lib/run-analysis";

export const maxDuration = 60;

type PageProps = { params: Promise<{ id: string }> };

export default function RoomPage(props: PageProps) {
  return (
    <FusionRoot>
      <Suspense fallback={<ScreenFallback wide />}>
        <RoomContent params={props.params} />
      </Suspense>
    </FusionRoot>
  );
}

async function RoomContent({ params }: PageProps) {
  await connection();
  const [{ id: rawId }, account] = await Promise.all([
    params,
    currentAccount(),
  ]);
  const id = parseRoomId(rawId);
  if (!id) {
    return (
      <Shell signedIn={Boolean(account)} fusionHome>
        <RoomMessage code="unavailable" />
      </Shell>
    );
  }
  if (!account) {
    return (
      <Shell signedIn={false} fusionHome>
        <RedirectNotice
          code="login"
          href={`/auth/login?next=${encodeURIComponent(`/rooms/${id}`)}`}
        />
      </Shell>
    );
  }

  const view = await readRoomForMember(supabaseMembershipStore, account.id, id);
  if (!view.ok) {
    if (view.code === "forbidden") {
      return (
        <Shell signedIn fusionHome>
          <RedirectNotice code="join" href={`/join/${id}`} />
        </Shell>
      );
    }
    return (
      <Shell signedIn fusionHome>
        <RoomMessage code={view.code === "save" ? "save" : "unavailable"} />
      </Shell>
    );
  }

  let events: StoredEvent[] = [];
  try {
    events = sortEventsNewestFirst(await supabaseRoomStore.listEvents(id));
  } catch {
    events = [];
  }

  const viewer = view.members.find((member) => member.userId === account.id);
  const viewerName = viewer?.name ?? account.name;
  let board;
  try {
    board = await loadRoomBoard(account, view.room, view.members);
  } catch {
    board = toBoard({
      room: view.room,
      members: view.members,
      events,
      saved: null,
      viewerName,
    });
  }

  after(() => trackAnalysis(id, { markPending: false }));

  return (
    <Shell signedIn bare>
      <RoomScreen
        account={<AccountSlot signedIn />}
        key={view.room.id}
        room={{
          id: view.room.id,
          topic: view.room.topic,
          dueDate: view.room.dueDate,
          parts: view.room.parts,
          token: view.room.token,
          path: invitePath(view.room.id, view.room.token),
          members: view.members.map((member) => ({
            name: member.name,
            part: member.part,
          })),
          viewerName,
          events,
        }}
        board={board}
      />
    </Shell>
  );
}
