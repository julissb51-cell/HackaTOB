import { after, connection } from "next/server";
import { loadRoomBoard } from "@/lib/board";
import { currentAccount } from "@/lib/current-account";
import { readRoomForMember } from "@/lib/room-membership";
import { supabaseMembershipStore } from "@/lib/room-membership-db";
import { parseRoomId } from "@/lib/room-fields";
import { trackAnalysis } from "@/lib/run-analysis";

export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  await connection();
  const id = parseRoomId((await context.params).id);
  const account = await currentAccount();
  if (!id || !account) return Response.json({ error: "no autorizado" }, { status: 401 });

  const view = await readRoomForMember(supabaseMembershipStore, account.id, id);
  if (!view.ok) return Response.json({ error: "no autorizado" }, { status: 401 });

  try {
    const board = await loadRoomBoard(account, view.room, view.members);
    if (board.pending) {
      after(() => trackAnalysis(id, { markPending: false }));
    }
    return Response.json(board, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    console.error("board", error instanceof Error ? error.name : "error");
    return Response.json({ error: "no se pudo leer la sala" }, { status: 500 });
  }
}
