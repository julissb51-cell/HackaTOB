/** Estado del proceso. No incluye claves, tokens ni texto de las salas. */
export function GET() {
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
