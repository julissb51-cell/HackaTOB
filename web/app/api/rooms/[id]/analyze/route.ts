import { connection } from "next/server";
import { optionsResponse, postAnalyze } from "@/lib/room-api";
import { scheduleRoomAnalysis } from "@/lib/run-analysis";
import { supabaseRoomStore } from "@/lib/room-store";

export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

export async function OPTIONS(request: Request) {
  await connection();
  return optionsResponse(request);
}

export async function POST(request: Request, context: RouteContext) {
  await connection();
  const { id } = await context.params;
  return postAnalyze(request, id, supabaseRoomStore, async (roomId) => {
    const outcome = await scheduleRoomAnalysis(roomId, { force: true });
    return outcome !== "failed";
  });
}
