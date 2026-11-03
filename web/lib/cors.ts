const EXTENSION_ORIGIN = /^chrome-extension:\/\/([a-p]{32})$/;

export function extensionOrigin(origin: string | null): string | null {
  if (!origin || !EXTENSION_ORIGIN.test(origin)) return null;
  return origin;
}

export function corsHeaders(request: Request): Headers {
  const headers = new Headers();
  const origin = extensionOrigin(request.headers.get("origin"));
  if (!origin) return headers;
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  headers.set("access-control-allow-headers", "Content-Type, x-room-token");
  headers.set("access-control-max-age", "86400");
  return headers;
}
