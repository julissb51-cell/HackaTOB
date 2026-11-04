# Quita solo los ganchos de Enlaza y la carpeta ~/.cursor/enlaza.
param(
  [string]$CursorHome = ""
)

$ErrorActionPreference = "Stop"

function Get-DefaultCursorHome {
  if ($env:USERPROFILE) { return $env:USERPROFILE }
  return $env:HOME
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

$cursorDir = Join-Path $homeDir ".cursor"
$enlazaDir = Join-Path $cursorDir "enlaza"
$hooksPath = Join-Path $cursorDir "hooks.json"

if (Test-Path -LiteralPath $hooksPath) {
  $stamp = Get-Date -Format "yyyyMMddHHmmss"
  $backup = "$hooksPath.bak-uninstall-$stamp"
  Copy-Item -LiteralPath $hooksPath -Destination $backup -Force
  $hooks = Get-Content -LiteralPath $hooksPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $merged = [ordered]@{}
  if ($hooks.hooks) {
    foreach ($prop in $hooks.hooks.PSObject.Properties) {
      $kept = New-Object System.Collections.Generic.List[object]
      foreach ($entry in (As-List $prop.Value)) {
        if (-not (Test-EnlazaCommand $entry)) { $kept.Add($entry) }
      }
      if ($kept.Count -gt 0) { $merged[$prop.Name] = $kept.ToArray() }
    }
  }
  $version = 1
  if ($hooks.version) { $version = $hooks.version }
  $utf8 = New-Object System.Text.UTF8Encoding $false
  $document = [ordered]@{ version = $version; hooks = $merged }
  [System.IO.File]::WriteAllText($hooksPath, (($document | ConvertTo-Json -Depth 6) + "`n"), $utf8)
  Write-Host "Guardé una copia en $backup"
}

if (Test-Path -LiteralPath $enlazaDir) {
  Remove-Item -LiteralPath $enlazaDir -Recurse -Force
}

Write-Host "Saqué Enlaza. El resto de tus ganchos quedó igual."
exit 0
