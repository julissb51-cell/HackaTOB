import { connection } from "next/server";
import { optionsResponse, postEvent } from "@/lib/room-api";
import { supabaseRoomStore } from "@/lib/room-store";

type RouteContext = { params: Promise<{ id: string }> };

export async function OPTIONS(request: Request) {
  await connection();
  return optionsResponse(request);
}

export async function POST(request: Request, context: RouteContext) {
  await connection();
  const { id } = await context.params;
  return postEvent(request, id, supabaseRoomStore);
}
