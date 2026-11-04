#!/bin/sh
# Mismo gancho para Mac o Linux. No bloquea el prompt.
# Config: $ENLAZA_CONFIG o ~/.cursor/enlaza/config.json
set -u

allow='{"continue":true}'
event_arg="${1:-}"
if [ "$event_arg" = "response" ]; then
  allow='{}'
fi

raw=$(cat 2>/dev/null || true)
finish() {
  printf '%s\n' "$allow"
  exit 0
}

if ! command -v python3 >/dev/null 2>&1; then
  echo "enlaza: falta python3" >&2
  finish
fi

ENLAZA_RAW=$raw ENLAZA_EVENT=$event_arg python3 - <<'PY'
import json, os, sys, urllib.parse, urllib.request
from datetime import datetime, timedelta, timezone

raw = os.environ.get("ENLAZA_RAW", "")
event = os.environ.get("ENLAZA_EVENT", "")
allow = {"value": '{"continue":true}'}

def fail(msg):
    print(msg, file=sys.stderr)

try:
    obj = json.loads(raw) if raw.strip() else {}
    if not isinstance(obj, dict):
        obj = {}
except Exception:
    fail("enlaza: no se pudo enviar")
    print(allow["value"])
    sys.exit(0)

name = str(obj.get("hook_event_name") or "")
tipo = ""
if event == "prompt" or name == "beforeSubmitPrompt":
    tipo = "prompt"
elif event == "response" or name == "afterAgentResponse":
    tipo = "respuesta"
    allow["value"] = "{}"
elif obj.get("text") and not obj.get("prompt"):
    tipo = "respuesta"
    allow["value"] = "{}"
elif obj.get("prompt"):
    tipo = "prompt"

def clean(value):
    text = value if isinstance(value, str) else ""
    return "".join(ch for ch in text if ch in "\t\n\r" or ord(ch) >= 32)

texto = clean(obj.get("prompt" if tipo == "prompt" else "text")).strip()
if len(texto) > 100000:
    texto = texto[:100000]
if not tipo or not texto:
    print(allow["value"])
    sys.exit(0)

path = os.environ.get("ENLAZA_CONFIG") or os.path.join(os.path.expanduser("~"), ".cursor", "enlaza", "config.json")
try:
    with open(path, encoding="utf-8") as handle:
        config = json.load(handle)
    base = str(config.get("baseUrl") or "https://enlaza-green.vercel.app").rstrip("/")
    sala = str(config.get("salaId") or config.get("roomId") or "").strip()
    token = str(config.get("token") or "").strip()
    miembro = str(config.get("miembro") or config.get("member") or "").strip()
    if not sala or not token or not miembro:
        raise ValueError("incompleto")
except Exception:
    fail("enlaza: falta config.json")
    print(allow["value"])
    sys.exit(0)

conversation = clean(obj.get("conversation_id") or obj.get("session_id") or obj.get("generation_id")).strip() or "cursor_local"
conversation = conversation[:500]
wall = datetime.now(timezone.utc) + timedelta(hours=-6)
body = {
    "event_id": "evt_cursor_" + os.urandom(16).hex(),
    "tipo": tipo,
    "miembro": miembro,
    "ia": "cursor",
    "conversation_id": conversation,
    "texto": texto,
    "tiempo": wall.strftime("%Y-%m-%dT%H:%M:%S") + "-06:00",
}
first = next((line.strip() for line in texto.splitlines() if line.strip()), "")
if first:
    body["nombre_chat"] = first[:80]
data = json.dumps(body).encode("utf-8")
req = urllib.request.Request(
    base + "/api/rooms/" + urllib.parse.quote(sala, safe="") + "/events",
    data=data,
    headers={"Content-Type": "application/json; charset=utf-8", "x-room-token": token},
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=4) as res:
        fail("enlaza: %s" % res.status)
except Exception as exc:
    code = getattr(getattr(exc, "code", None), "real", None) or getattr(exc, "code", None)
    fail("enlaza: %s" % code if code else "enlaza: no se pudo enviar")
print(allow["value"])
PY
status=$?
if [ "$status" -ne 0 ]; then
  printf '%s\n' "$allow"
fi
exit 0
