import "server-only";
import { cookies } from "next/headers";
import { roomTokenCookieName } from "./room-fields";

export async function rememberRoomToken(roomId: string, token: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]{1,500}$/.test(token)) return;
  const jar = await cookies();
  jar.set(roomTokenCookieName(roomId), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
}
