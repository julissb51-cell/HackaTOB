# Enlaza en Cursor

Cursor es un programa de escritorio. La extensión del navegador no lo ve. Este gancho manda a tu sala cada prompt y cada respuesta del agente.

Funciona en Windows 11. No hace falta instalar Node ni Python.

## Instalar

Abrí PowerShell en esta carpeta y pegá tu enlace de invitación y tu nombre:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -Invite "https://enlaza-green.vercel.app/join/TU-SALA?t=TU-TOKEN" -Member "Ana"
```

Eso guarda la configuración en `%USERPROFILE%\.cursor\enlaza\config.json`, copia el gancho ahí y lo agrega a `%USERPROFILE%\.cursor\hooks.json`. Si ya tenías otros ganchos, los deja. Antes guarda una copia `hooks.json.bak-...`.

Cursor recarga los ganchos solo. Si el primer mensaje no aparece en la sala, cerrá Cursor y volvé a abrirlo.

## Probar

1. Entrá a tu sala en el navegador.
2. En Cursor, en el chat del agente, mandá un mensaje y esperá la respuesta.
3. En la actividad de la sala tiene que aparecer tu nombre, la IA **Cursor**, el prompt y la respuesta.

El gancho no frena el chat. Si no hay internet, Cursor sigue y el mensaje no se guarda. El resultado de cada envío queda en `%USERPROFILE%\.cursor\enlaza\hook.log` (hora, evento y código o error; sin el token ni el texto).

## Desinstalar

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\uninstall.ps1
```

Saca las entradas de Enlaza y borra `%USERPROFILE%\.cursor\enlaza`. El resto de `hooks.json` queda igual. También deja una copia `hooks.json.bak-uninstall-...`.

## Mac o Linux

El archivo `enlaza-hook.sh` hace lo mismo si tenés `python3`. Copialo a `~/.cursor/enlaza/`, creá ahí un `config.json` como `config.example.json` y sumá en `~/.cursor/hooks.json` (sin borrar lo que ya esté):

```json
{
  "version": 1,
  "hooks": {
    "beforeSubmitPrompt": [{ "command": "bash ~/.cursor/enlaza/enlaza-hook.sh prompt", "timeout": 8 }],
    "afterAgentResponse": [{ "command": "bash ~/.cursor/enlaza/enlaza-hook.sh response", "timeout": 8 }]
  }
}
```
