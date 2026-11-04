# Gancho de Cursor para Enlaza. Nunca bloquea el prompt: sale 0 y responde continue.
# Windows PowerShell 5.1 y PowerShell 7. El JSON entra por stdin en UTF-8.
param(
  [ValidateSet("", "prompt", "response")]
  [string]$Event = "",
  [switch]$SelfTest
)

$ErrorActionPreference = "Stop"
try {
  $utf8Console = New-Object System.Text.UTF8Encoding $false
  [Console]::OutputEncoding = $utf8Console
  $OutputEncoding = $utf8Console
} catch {
  # La consola vieja sigue; el POST igual va en UTF-8.
}

function Read-Utf8Stdin {
  $stream = [Console]::OpenStandardInput()
  $buffer = New-Object byte[] 8192
  $memory = New-Object System.IO.MemoryStream
  while (($count = $stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
    $memory.Write($buffer, 0, $count)
  }
  $bytes = $memory.ToArray()
  $offset = 0
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 239 -and $bytes[1] -eq 187 -and $bytes[2] -eq 191) {
    $offset = 3
  }
  if ($bytes.Length -le $offset) { return "" }
  return Decode-HookBytes $bytes $offset
}

function Get-Cp1252([switch]$Strict) {
  $name = 1252
  try {
    [System.Text.Encoding]::GetEncoding($name) | Out-Null
  } catch {
    [System.Text.Encoding]::RegisterProvider([System.Text.CodePagesEncodingProvider]::Instance)
  }
  if (-not $Strict) { return [System.Text.Encoding]::GetEncoding($name) }
  $encoder = New-Object System.Text.EncoderExceptionFallback
  $decoder = New-Object System.Text.DecoderExceptionFallback
  return [System.Text.Encoding]::GetEncoding($name, $encoder, $decoder)
}

# UTF-8 leído como Windows-1252: Ã©, Â«, â€.
$script:MojibakePattern = '[\u00C2\u00C3](?:[\u0080-\u00BF\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178])|\u00E2\u20AC'

function Decode-HookBytes([byte[]]$bytes, [int]$offset) {
  $count = $bytes.Length - $offset
  if ($count -le 0) { return "" }
  $strict = New-Object System.Text.UTF8Encoding $false, $true
  try {
    return $strict.GetString($bytes, $offset, $count)
  } catch {
    return (Get-Cp1252).GetString($bytes, $offset, $count)
  }
}

function Repair-Mojibake([string]$text) {
  if ([string]::IsNullOrEmpty($text)) { return $text }
  if ($text -notmatch $script:MojibakePattern) { return $text }
  try {
    $bytes = (Get-Cp1252 -Strict).GetBytes($text)
    $utf8 = New-Object System.Text.UTF8Encoding $false, $true
    return $utf8.GetString($bytes)
  } catch {
    return $text
  }
}

function Repair-HookFields($obj) {
  if ($null -eq $obj) { return }
  foreach ($name in @("prompt", "text")) {
    $prop = $obj.PSObject.Properties[$name]
    if ($null -eq $prop -or $prop.Value -isnot [string]) { continue }
    $prop.Value = Repair-Mojibake ([string]$prop.Value)
  }
}

function Invoke-RepairSelfTest {
  $utf8 = New-Object System.Text.UTF8Encoding $false
  $cp = Get-Cp1252
  $original = ([char]0x00AB) + "qu" + ([char]0x00E9) + ([char]0x00BB)
  $mojibake = $cp.GetString($utf8.GetBytes($original))
  $fixed = Repair-Mojibake $mojibake
  if ($fixed -ne $original) { throw "mojibake [$mojibake] -> [$fixed]" }
  $good = "explicame " + ([char]0x00E9) + "s una tabla en una base de datos"
  if ((Repair-Mojibake $good) -ne $good) { throw "altero [$good]" }
  $sentence = ([char]0x00AB) + $good + ([char]0x00BB)
  if ((Repair-Mojibake ($cp.GetString($utf8.GetBytes($sentence)))) -ne $sentence) { throw "frase" }
  if ((Repair-Mojibake "hola") -ne "hola") { throw "hola" }
  if ((Repair-Mojibake $original) -ne $original) { throw "ya estaba bien" }
}

function Get-EnlazaDir {
  if ($env:ENLAZA_CONFIG) {
    $parent = Split-Path -Parent $env:ENLAZA_CONFIG
    if ($parent) { return $parent }
  }
  $beside = Join-Path $PSScriptRoot "config.json"
  if (Test-Path -LiteralPath $beside) { return $PSScriptRoot }
  return Join-Path (Get-CursorHome) ".cursor/enlaza"
}

function Write-HookLog([string]$eventName, [string]$detail) {
  try {
    $dir = Get-EnlazaDir
    if (-not $dir) { return }
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $path = Join-Path $dir "hook.log"
    $clean = ([regex]::Replace([string]$detail, '[\r\n]', ' ')).Trim()
    if ($clean.Length -gt 240) { $clean = $clean.Substring(0, 240) }
    $line = "{0} {1} {2}" -f (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss"), ($eventName.Trim()), $clean
    $utf8 = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::AppendAllText($path, $line + "`n", $utf8)
    if ((Get-Item -LiteralPath $path).Length -gt 65536) {
      $existing = [System.IO.File]::ReadAllLines($path, $utf8)
      $start = [Math]::Max(0, $existing.Length - 200)
      $kept = $existing[$start..($existing.Length - 1)]
      [System.IO.File]::WriteAllText($path, (($kept -join "`n") + "`n"), $utf8)
    }
  } catch {
    # El log no puede frenar el prompt.
  }
}

function Get-CursorHome {
  if ($env:USERPROFILE) { return $env:USERPROFILE }
  return $env:HOME
}

function Get-EnlazaConfig {
  $path = ""
  if ($env:ENLAZA_CONFIG) { $path = $env:ENLAZA_CONFIG }
  if (-not $path) {
    $beside = Join-Path $PSScriptRoot "config.json"
    if (Test-Path -LiteralPath $beside) { $path = $beside }
  }
  if (-not $path) {
    $path = Join-Path (Get-CursorHome) ".cursor/enlaza/config.json"
  }
  if (-not (Test-Path -LiteralPath $path)) { return $null }
  $parsed = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
  $base = [string]$parsed.baseUrl
  if (-not $base) { $base = "https://enlaza-green.vercel.app" }
  $base = $base.TrimEnd("/")
  $sala = [string]$parsed.salaId
  if (-not $sala) { $sala = [string]$parsed.roomId }
  $token = [string]$parsed.token
  $miembro = [string]$parsed.miembro
  if (-not $miembro) { $miembro = [string]$parsed.member }
  if (-not $sala.Trim() -or -not $token.Trim() -or -not $miembro.Trim()) { return $null }
  return @{
    baseUrl = $base
    salaId = $sala.Trim()
    token = $token.Trim()
    miembro = $miembro.Trim()
  }
}

function Get-CostaRicaIso {
  $wall = [DateTime]::UtcNow.AddHours(-6)
  return $wall.ToString("yyyy-MM-ddTHH:mm:ss") + "-06:00"
}

function Remove-ControlChars([string]$value) {
  if ($null -eq $value) { return "" }
  return ([regex]::Replace($value, '[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]', ''))
}

function Get-FieldText($obj, [string]$name) {
  if ($null -eq $obj) { return "" }
  $prop = $obj.PSObject.Properties[$name]
  if ($null -eq $prop -or $prop.Value -isnot [string]) { return "" }
  return Remove-ControlChars ([string]$prop.Value)
}

function Send-EnlazaEvent($obj, [string]$tipo, [string]$texto) {
  $config = Get-EnlazaConfig
  if ($null -eq $config) {
    [Console]::Error.WriteLine("enlaza: falta config.json")
    Write-HookLog $tipo "falta config.json"
    return
  }
  $conversation = Get-FieldText $obj "conversation_id"
  if (-not $conversation.Trim()) { $conversation = Get-FieldText $obj "session_id" }
  if (-not $conversation.Trim()) { $conversation = Get-FieldText $obj "generation_id" }
  $conversation = $conversation.Trim()
  if (-not $conversation) { $conversation = "cursor_local" }
  if ($conversation.Length -gt 500) { $conversation = $conversation.Substring(0, 500) }

  $body = [ordered]@{
    event_id = "evt_cursor_" + [guid]::NewGuid().ToString("N")
    tipo = $tipo
    miembro = $config.miembro
    ia = "cursor"
    conversation_id = $conversation
    texto = $texto
    tiempo = (Get-CostaRicaIso)
  }
  $first = $null
  foreach ($line in ($texto -split '\r?\n')) {
    if ($line.Trim()) { $first = $line.Trim(); break }
  }
  if ($first) {
    if ($first.Length -gt 80) { $first = $first.Substring(0, 80) }
    $body.nombre_chat = $first
  }
  $json = $body | ConvertTo-Json -Compress -Depth 4
  $url = "$($config.baseUrl)/api/rooms/$([uri]::EscapeDataString($config.salaId))/events"
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  try {
    $response = Invoke-WebRequest -Uri $url -Method POST -Headers @{
      "x-room-token" = $config.token
    } -ContentType "application/json; charset=utf-8" -Body $bytes -TimeoutSec 4 -UseBasicParsing
    [Console]::Error.WriteLine("enlaza: $($response.StatusCode)")
    Write-HookLog $tipo "status $($response.StatusCode)"
  } catch {
    $code = 0
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
      $code = [int]$_.Exception.Response.StatusCode
    }
    if ($code -gt 0) {
      [Console]::Error.WriteLine("enlaza: $code")
      Write-HookLog $tipo "status $code"
    } else {
      $detail = $_.Exception.Message
      [Console]::Error.WriteLine("enlaza: no se pudo enviar: $detail")
      Write-HookLog $tipo "enviar: $detail"
    }
  }
}

if ($SelfTest) {
  try {
    Invoke-RepairSelfTest
  } catch {
    [Console]::Error.WriteLine("enlaza: prueba: $($_.Exception.Message)")
    exit 1
  }
  Write-Output "repair ok"
  exit 0
}

$allow = '{"continue":true}'
if ($Event -eq "response") { $allow = "{}" }
$eventLabel = $Event
if (-not $eventLabel) { $eventLabel = "hook" }

try {
  # No usar $input: PowerShell 5.1 se come el stdin y lo decodifica con la pagina OEM.
  if ([Console]::IsInputRedirected) {
    $raw = Read-Utf8Stdin
  } else {
    $raw = ""
  }
  $obj = $null
  if ($raw -and $raw.Trim()) {
    $obj = $raw | ConvertFrom-Json
    Repair-HookFields $obj
  }
  $hookName = Get-FieldText $obj "hook_event_name"
  $tipo = ""
  if ($Event -eq "prompt" -or $hookName -eq "beforeSubmitPrompt") {
    $tipo = "prompt"
  } elseif ($Event -eq "response" -or $hookName -eq "afterAgentResponse") {
    $tipo = "respuesta"
    $allow = "{}"
  } elseif ((Get-FieldText $obj "text") -and -not (Get-FieldText $obj "prompt")) {
    $tipo = "respuesta"
    $allow = "{}"
  } elseif (Get-FieldText $obj "prompt") {
    $tipo = "prompt"
  }

  if ($tipo) {
    $source = "prompt"
    if ($tipo -eq "respuesta") { $source = "text" }
    $texto = (Get-FieldText $obj $source).Trim()
    if ($texto.Length -gt 100000) { $texto = $texto.Substring(0, 100000) }
    if ($texto) { Send-EnlazaEvent $obj $tipo $texto }
  } else {
    Write-HookLog $eventLabel "sin texto"
  }
} catch {
  $detail = $_.Exception.Message
  [Console]::Error.WriteLine("enlaza: no se pudo leer: $detail")
  Write-HookLog $eventLabel "leer: $detail"
} finally {
  Write-Output $allow
}

exit 0
