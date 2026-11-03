import { corsHeaders } from "./cors";

export function json(request: Request, body: unknown, status: number): Response {
  const headers = corsHeaders(request);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "private, no-store");
  headers.set("vary", "origin, x-room-token");
  return new Response(JSON.stringify(body), { status, headers });
}

export function optionsResponse(request: Request): Response {
  const headers = corsHeaders(request);
  headers.set("vary", "origin");
  return new Response(null, { status: 204, headers });
}
