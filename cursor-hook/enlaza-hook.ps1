# Gancho de Cursor para Enlaza. Nunca bloquea el prompt: sale 0 y responde continue.
# Windows PowerShell 5.1 y PowerShell 7. Lee el JSON por pipeline ($input) o por stdin.
param(
  [ValidateSet("", "prompt", "response")]
  [string]$Event = ""
)

$ErrorActionPreference = "Stop"

function Read-HookRaw {
  if ($script:pipelineText -and $script:pipelineText.Trim()) { return $script:pipelineText }
  if ([Console]::IsInputRedirected) { return [Console]::In.ReadToEnd() }
  return ""
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
  } catch {
    $code = 0
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
      $code = [int]$_.Exception.Response.StatusCode
    }
    if ($code -gt 0) {
      [Console]::Error.WriteLine("enlaza: $code")
    } else {
      [Console]::Error.WriteLine("enlaza: no se pudo enviar")
    }
  }
}

$script:pipelineText = ""
foreach ($item in $input) {
  if ($null -eq $item) { continue }
  if ($script:pipelineText) { $script:pipelineText += "`n" }
  $script:pipelineText += [string]$item
}

$allow = '{"continue":true}'
if ($Event -eq "response") { $allow = "{}" }

try {
  $raw = Read-HookRaw
  $obj = $null
  if ($raw -and $raw.Trim()) {
    $obj = $raw | ConvertFrom-Json
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
  }
} catch {
  [Console]::Error.WriteLine("enlaza: no se pudo enviar")
} finally {
  Write-Output $allow
}

exit 0
