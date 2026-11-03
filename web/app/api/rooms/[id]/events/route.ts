import { after, connection } from "next/server";
import { optionsResponse, postEvent } from "@/lib/room-api";
import { trackAnalysis } from "@/lib/run-analysis";
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
  const response = await postEvent(request, id, supabaseRoomStore);
  if (response.status === 200) {
    after(() => trackAnalysis(id, { markPending: true }));
  }
  return response;
}
