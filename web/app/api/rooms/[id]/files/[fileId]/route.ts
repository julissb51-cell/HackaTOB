import { connection } from "next/server";
import { optionsResponse } from "@/lib/http";
import { openFile, removeFile } from "@/lib/room-files-api";

type RouteContext = { params: Promise<{ id: string; fileId: string }> };

export async function OPTIONS(request: Request) {
  await connection();
  return optionsResponse(request);
}

export async function GET(request: Request, context: RouteContext) {
  await connection();
  const { id, fileId } = await context.params;
  return openFile(request, id, fileId);
}

export async function DELETE(request: Request, context: RouteContext) {
  await connection();
  const { id, fileId } = await context.params;
  return removeFile(request, id, fileId);
}
