export function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  const hostHeader = firstHeader(request.headers.get("x-forwarded-host") ?? request.headers.get("host"));
  const protoHeader = firstHeader(request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", ""));
  if (!hostHeader || !/^[A-Za-z0-9.-]+(?::\d+)?$/.test(hostHeader)) return url.origin;
  if (protoHeader !== "http" && protoHeader !== "https") return url.origin;
  return `${protoHeader}://${hostHeader}`;
}

function firstHeader(value: string | null): string {
  return value?.split(",")[0]?.trim() ?? "";
}
