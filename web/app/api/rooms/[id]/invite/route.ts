import { connection } from "next/server";
import { currentAccount } from "@/lib/current-account";
import { createRateLimiter, inviteEmailText, isEmail } from "@/lib/invite-email";
import { readRoomForMember } from "@/lib/room-membership";
import { supabaseMembershipStore } from "@/lib/room-membership-db";
import { invitePath, parseRoomId } from "@/lib/room-fields";

type RouteContext = { params: Promise<{ id: string }> };

// 5 invitaciones por persona cada 10 minutos (por instancia de la función).
const allowInvite = createRateLimiter(5, 10 * 60 * 1000);

/** POST /api/rooms/:id/invite { email } — manda el enlace de invitación por Gmail SMTP si está configurado. */
export async function POST(request: Request, context: RouteContext) {
  await connection();
  const id = parseRoomId((await context.params).id);
  const account = await currentAccount();
  if (!id || !account) return Response.json({ ok: false, error: "auth" }, { status: 401 });

  const view = await readRoomForMember(supabaseMembershipStore, account.id, id);
  if (!view.ok) return Response.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!isEmail(email)) return Response.json({ ok: false, error: "invalid" }, { status: 400 });

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return Response.json({ ok: false, error: "not_configured" }, { status: 503 });

  if (!allowInvite(account.id)) return Response.json({ ok: false, error: "rate_limited" }, { status: 429 });

  const url = `${new URL(request.url).origin}${invitePath(view.room.id, view.room.token)}`;
  const message = inviteEmailText(view.room.language, account.name, view.room.topic, url);
  try {
    const { createTransport } = await import("nodemailer");
    const transport = createTransport({ service: "gmail", auth: { user, pass } });
    await transport.sendMail({ from: `Enlaza <${user}>`, to: email, subject: message.subject, text: message.text });
  } catch (error) {
    console.error("invite.email", error instanceof Error ? error.name : "error");
    return Response.json({ ok: false, error: "failed" }, { status: 502 });
  }
  return Response.json({ ok: true });
}
