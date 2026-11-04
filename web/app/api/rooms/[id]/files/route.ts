import { connection } from "next/server";
import { optionsResponse } from "@/lib/http";
import { getFiles, postFile } from "@/lib/room-files-api";

type RouteContext = { params: Promise<{ id: string }> };

export async function OPTIONS(request: Request) {
  await connection();
  return optionsResponse(request);
}

export async function GET(request: Request, context: RouteContext) {
  await connection();
  const { id } = await context.params;
  return getFiles(request, id);
}

export async function POST(request: Request, context: RouteContext) {
  await connection();
  const { id } = await context.params;
  return postFile(request, id);
}
