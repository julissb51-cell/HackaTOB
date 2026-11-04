# Instala el gancho de Enlaza en %USERPROFILE%\.cursor sin borrar otros ganchos.
param(
  [Parameter(Mandatory = $true)][string]$Invite,
  [Parameter(Mandatory = $true)][string]$Member,
  [string]$CursorHome = ""
)

$ErrorActionPreference = "Stop"

function Get-DefaultCursorHome {
  if ($env:USERPROFILE) { return $env:USERPROFILE }
  return $env:HOME
}

function Parse-Invite([string]$invite) {
  $value = $invite.Trim()
  if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
    $value = $value.Substring(1, $value.Length - 2).Trim()
  }
  if (-not $value) { throw "Falta el enlace de invitacion." }
  $uri = $null
  if (-not [Uri]::TryCreate($value, [UriKind]::Absolute, [ref]$uri)) { throw "El enlace no es valido." }
  if ($uri.Scheme -ne "https" -or $uri.Host -ne "enlaza-green.vercel.app") {
    throw "El enlace tiene que ser de enlaza-green.vercel.app."
  }
  $parts = @($uri.AbsolutePath.Trim("/").Split("/") | Where-Object { $_ })
  if ($parts.Count -lt 2) { throw "Ese enlace no es una invitacion a una sala." }
  $head = $parts[0].ToLower()
  if ($head -ne "join" -and $head -ne "room") { throw "Ese enlace no es una invitacion a una sala." }
  $sala = [Uri]::UnescapeDataString($parts[1]).Trim().ToLower()
  if ($sala -notmatch '^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$') { throw "El id de la sala no es valido." }
  $reserved = @("new", "api", "auth", "join", "rooms", "room")
  if ($reserved -contains $sala) { throw "El id de la sala no es valido." }
  $token = ""
  $query = $uri.Query.TrimStart("?")
  if ($query) {
    foreach ($pair in $query.Split("&")) {
      if (-not $pair) { continue }
      $eq = $pair.IndexOf("=")
      if ($eq -lt 0) { continue }
      $key = [Uri]::UnescapeDataString($pair.Substring(0, $eq))
      $parsed = [Uri]::UnescapeDataString($pair.Substring($eq + 1))
      if ($key -eq "t" -or $key -eq "token") { $token = $parsed.Trim() }
    }
  }
  if (-not $token -or $token.Length -gt 500) { throw "El enlace no trae un token valido." }
  return @{ salaId = $sala; token = $token }
}

function As-List($value) {
  if ($null -eq $value) { return @() }
  return @($value)
}

function Test-EnlazaCommand($entry) {
  return [string]$entry.command -match 'enlaza-hook\.(ps1|sh|mjs)'
}

$homeDir = $CursorHome
if (-not $homeDir) { $homeDir = Get-DefaultCursorHome }
if (-not $homeDir) { throw "No encuentro la carpeta del usuario." }

$parsedInvite = Parse-Invite $Invite
$name = [regex]::Replace($Member.Trim(), '\s+', ' ')
if (-not $name) { throw "Escribe tu nombre." }
if ($name.Length -gt 120) { throw "El nombre puede tener hasta 120 caracteres." }
if ([regex]::IsMatch($name, '[\u0000-\u001F\u007F]')) { throw "El nombre no es valido." }

$cursorDir = Join-Path $homeDir ".cursor"
$enlazaDir = Join-Path $cursorDir "enlaza"
$hooksPath = Join-Path $cursorDir "hooks.json"
New-Item -ItemType Directory -Force -Path $enlazaDir | Out-Null

$source = Join-Path $PSScriptRoot "enlaza-hook.ps1"
if (-not (Test-Path -LiteralPath $source)) { throw "No encuentro enlaza-hook.ps1 junto a install.ps1." }
Copy-Item -LiteralPath $source -Destination (Join-Path $enlazaDir "enlaza-hook.ps1") -Force
$uninstall = Join-Path $PSScriptRoot "uninstall.ps1"
if (Test-Path -LiteralPath $uninstall) {
  Copy-Item -LiteralPath $uninstall -Destination (Join-Path $enlazaDir "uninstall.ps1") -Force
}

$config = [ordered]@{
  baseUrl = "https://enlaza-green.vercel.app"
  salaId = $parsedInvite.salaId
  token = $parsedInvite.token
  miembro = $name
}
$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText((Join-Path $enlazaDir "config.json"), (($config | ConvertTo-Json -Compress) + "`n"), $utf8)

$hooks = $null
if (Test-Path -LiteralPath $hooksPath) {
  $stamp = Get-Date -Format "yyyyMMddHHmmss"
  $backup = "$hooksPath.bak-$stamp"
  Copy-Item -LiteralPath $hooksPath -Destination $backup -Force
  Write-Host "Guarde una copia de hooks.json en $backup"
  try {
    $hooks = Get-Content -LiteralPath $hooksPath -Raw -Encoding UTF8 | ConvertFrom-Json
  } catch {
    throw "hooks.json no se pudo leer. La copia quedo en $backup y no lo reemplace."
  }
}

$names = @()
if ($hooks -and $hooks.hooks) {
  foreach ($prop in $hooks.hooks.PSObject.Properties) { $names += $prop.Name }
}
if ($names -notcontains "beforeSubmitPrompt") { $names += "beforeSubmitPrompt" }
if ($names -notcontains "afterAgentResponse") { $names += "afterAgentResponse" }

$scriptPath = Join-Path $enlazaDir "enlaza-hook.ps1"
$promptCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -Event prompt"
$responseCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -Event response"

$merged = [ordered]@{}
foreach ($hookName in $names) {
  $current = $null
  if ($hooks -and $hooks.hooks) { $current = $hooks.hooks.$hookName }
  $kept = New-Object System.Collections.Generic.List[object]
  foreach ($entry in (As-List $current)) {
    if (-not (Test-EnlazaCommand $entry)) { $kept.Add($entry) }
  }
  if ($hookName -eq "beforeSubmitPrompt") {
    $kept.Add([ordered]@{ command = $promptCommand; timeout = 8 })
  } elseif ($hookName -eq "afterAgentResponse") {
    $kept.Add([ordered]@{ command = $responseCommand; timeout = 8 })
  }
  $merged[$hookName] = $kept.ToArray()
}

$version = 1
if ($hooks -and $hooks.version) { $version = $hooks.version }
$document = [ordered]@{ version = $version; hooks = $merged }
[System.IO.File]::WriteAllText($hooksPath, (($document | ConvertTo-Json -Depth 6) + "`n"), $utf8)

Write-Host "Listo. Enlaza lee lo que envias en el chat de Cursor y la respuesta del agente."
Write-Host "Sala: $($parsedInvite.salaId)"
Write-Host "Miembro: $name"
Write-Host "Cursor recarga los ganchos solo. Si no ves el envio, cerralo y volve a abrirlo."
exit 0
