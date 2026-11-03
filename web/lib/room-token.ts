import { randomBytes } from "node:crypto";

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function generateRoomId(): string {
  const bytes = randomBytes(8);
  let id = "";
  for (const byte of bytes) id += ALPHABET[byte % ALPHABET.length];
  return id;
}

export function createRoomToken(): string {
  return randomBytes(32).toString("base64url");
}
