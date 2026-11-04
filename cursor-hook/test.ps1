# Prueba el instalador en una carpeta temporal y, con -Live, un envío real.
param(
  [switch]$Live,
  [string]$Invite = "",
  [string]$Member = "Ana"
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$fail = 0

function Assert-True($cond, [string]$message) {
  if (-not $cond) { throw $message }
}

$temp = Join-Path ([System.IO.Path]::GetTempPath()) ("enlaza-hook-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path (Join-Path $temp ".cursor") | Out-Null
$existing = @{
  version = 1
  hooks = @{
    beforeShellExecution = @(@{ command = "echo hola"; timeout = 5 })
    beforeSubmitPrompt = @(@{ command = "powershell.exe -File .\enlaza-hook.ps1 -Event prompt" })
  }
} | ConvertTo-Json -Depth 6
[System.IO.File]::WriteAllText((Join-Path $temp ".cursor/hooks.json"), $existing)

& (Join-Path $root "install.ps1") -Invite "https://enlaza-green.vercel.app/join/demo?t=token-de-prueba" -Member "Ana" -CursorHome $temp
if ($LASTEXITCODE -ne 0) { throw "install salió $LASTEXITCODE" }

$installed = Get-Content -LiteralPath (Join-Path $temp ".cursor/hooks.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$shell = @($installed.hooks.beforeShellExecution)
Assert-True ($shell.Count -eq 1 -and $shell[0].command -eq "echo hola") "se perdió el otro gancho"
$prompts = @($installed.hooks.beforeSubmitPrompt)
Assert-True ($prompts.Count -eq 1) "beforeSubmitPrompt duplicado: $($prompts.Count)"
Assert-True ($prompts[0].command -match 'enlaza-hook\.ps1') "falta el comando de prompt"
Assert-True ($prompts[0].command -match '-Event prompt') "falta -Event prompt"
$responses = @($installed.hooks.afterAgentResponse)
Assert-True ($responses.Count -eq 1 -and $responses[0].command -match '-Event response') "falta afterAgentResponse"
Assert-True (Test-Path -LiteralPath (Join-Path $temp ".cursor/enlaza/config.json")) "falta config"
Assert-True (Test-Path -LiteralPath (Join-Path $temp ".cursor/enlaza/enlaza-hook.ps1")) "falta el script"
$bak = @(Get-ChildItem -LiteralPath (Join-Path $temp ".cursor") -Filter "hooks.json.bak-*")
Assert-True ($bak.Count -ge 1) "no hubo copia de hooks.json"
$config = Get-Content -LiteralPath (Join-Path $temp ".cursor/enlaza/config.json") -Raw -Encoding UTF8 | ConvertFrom-Json
Assert-True ($config.salaId -eq "demo" -and $config.miembro -eq "Ana" -and $config.token -eq "token-de-prueba") "config distinta"

$bad = Join-Path $temp "mala.json"
[System.IO.File]::WriteAllText($bad, '{"baseUrl":"http://127.0.0.1:9","salaId":"demo","token":"no","miembro":"Ana"}')
$env:ENLAZA_CONFIG = $bad
$stdout = '{"prompt":"hola","conversation_id":"conv-1","hook_event_name":"beforeSubmitPrompt"}' | & (Join-Path $root "enlaza-hook.ps1") -Event prompt
Assert-True ($LASTEXITCODE -eq 0) "el gancho no salió 0"
Assert-True (($stdout | Out-String).Trim() -eq '{"continue":true}') "stdout prompt: $stdout"

$stdout = '{"text":"listo","conversation_id":"conv-1","hook_event_name":"afterAgentResponse"}' | & (Join-Path $root "enlaza-hook.ps1") -Event response
Assert-True ($LASTEXITCODE -eq 0) "la respuesta no salió 0"
Assert-True (($stdout | Out-String).Trim() -eq '{}') "stdout respuesta: $stdout"

$stdout = '{esto no es json' | & (Join-Path $root "enlaza-hook.ps1")
Assert-True ($LASTEXITCODE -eq 0) "json malo no salió 0"
Assert-True (($stdout | Out-String).Trim() -eq '{"continue":true}') "json malo bloqueó: $stdout"

$child = Join-Path $temp "child-out.txt"
$childErr = Join-Path $temp "child-err.txt"
'{"prompt":"por stdin","conversation_id":"conv-stdin","hook_event_name":"beforeSubmitPrompt"}' | & (Get-Process -Id $PID).Path -NoProfile -File (Join-Path $root "enlaza-hook.ps1") -Event prompt > $child 2> $childErr
Assert-True ($LASTEXITCODE -eq 0) "stdin hijo no salió 0"
Assert-True ((Get-Content -LiteralPath $child -Raw).Trim() -eq '{"continue":true}') "stdin hijo: $(Get-Content -LiteralPath $child -Raw)"
Assert-True ((Get-Content -LiteralPath $childErr -Raw) -match 'enlaza: no se pudo enviar') "stdin hijo no intentó enviar"

$utf8 = New-Object System.Text.UTF8Encoding $false
$accent = '{"hook_event_name":"beforeSubmitPrompt","prompt":"qué es una base de datos","conversation_id":"conv-utf8","attachments":[],"model_params":[{"id":"effort","value":"low"}]}'
$inFile = Join-Path $temp "utf8-bom.json"
$bom = [byte[]](0xEF, 0xBB, 0xBF)
$bodyBytes = $utf8.GetBytes($accent)
$withBom = New-Object byte[] ($bom.Length + $bodyBytes.Length)
[Array]::Copy($bom, 0, $withBom, 0, $bom.Length)
[Array]::Copy($bodyBytes, 0, $withBom, $bom.Length, $bodyBytes.Length)
[System.IO.File]::WriteAllBytes($inFile, $withBom)
$accentOut = Join-Path $temp "accent-out.txt"
$accentErr = Join-Path $temp "accent-err.txt"
$proc = Start-Process -FilePath (Get-Process -Id $PID).Path -ArgumentList @("-NoProfile", "-File", (Join-Path $root "enlaza-hook.ps1"), "-Event", "prompt") -RedirectStandardInput $inFile -RedirectStandardOutput $accentOut -RedirectStandardError $accentErr -Wait -PassThru -NoNewWindow
Assert-True ($proc.ExitCode -eq 0) "utf8 no salió 0"
Assert-True ((Get-Content -LiteralPath $accentOut -Raw).Trim() -eq '{"continue":true}') "utf8 stdout"
$accentErrText = Get-Content -LiteralPath $accentErr -Raw
Assert-True ($accentErrText -match 'enlaza: no se pudo enviar:') "utf8 no llegó a enviar: $accentErrText"
Assert-True ($accentErrText -notmatch 'no se pudo leer') "utf8 no parseó: $accentErrText"
$hookLog = Join-Path $temp "hook.log"
$logText = Get-Content -LiteralPath $hookLog -Raw -ErrorAction SilentlyContinue
Assert-True ($logText -and $logText -notmatch 'base de datos') "el log guardó el texto"
Assert-True ($logText -match 'beforeSubmitPrompt|prompt') "el log no tiene el evento"
Remove-Item Env:ENLAZA_CONFIG

& (Join-Path $root "uninstall.ps1") -CursorHome $temp
if ($LASTEXITCODE -ne 0) { throw "uninstall salió $LASTEXITCODE" }
Assert-True (-not (Test-Path -LiteralPath (Join-Path $temp ".cursor/enlaza"))) "la carpeta enlaza sigue"
$after = Get-Content -LiteralPath (Join-Path $temp ".cursor/hooks.json") -Raw -Encoding UTF8 | ConvertFrom-Json
Assert-True (-not $after.hooks.beforeSubmitPrompt) "quedó beforeSubmitPrompt"
Assert-True (-not $after.hooks.afterAgentResponse) "quedó afterAgentResponse"
Assert-True (@($after.hooks.beforeShellExecution)[0].command -eq "echo hola") "uninstall borró otro gancho"

if ($Live) {
  if (-not $Invite) { throw "Falta -Invite para la prueba en vivo" }
  $liveHome = Join-Path $temp "live"
  & (Join-Path $root "install.ps1") -Invite $Invite -Member $Member -CursorHome $liveHome
  if ($LASTEXITCODE -ne 0) { throw "install en vivo salió $LASTEXITCODE" }
  $marker = "Prueba del gancho de Cursor " + [guid]::NewGuid().ToString("N")
  $payload = @{
    prompt = $marker
    conversation_id = "cursor_hook_demo"
    hook_event_name = "beforeSubmitPrompt"
  } | ConvertTo-Json -Compress
  $env:ENLAZA_CONFIG = Join-Path $liveHome ".cursor/enlaza/config.json"
  $stderr = Join-Path $temp "stderr.txt"
  $stdoutFile = Join-Path $temp "stdout.txt"
  $payload | & (Get-Process -Id $PID).Path -NoProfile -File (Join-Path $root "enlaza-hook.ps1") -Event prompt > $stdoutFile 2> $stderr
  Assert-True ($LASTEXITCODE -eq 0) "en vivo no salió 0"
  $stdout = Get-Content -LiteralPath $stdoutFile -Raw
  $errText = Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue
  Assert-True ($stdout.Trim() -eq '{"continue":true}') "en vivo stdout: $stdout"
  Assert-True ($errText -match 'enlaza: 200') "en vivo no dio 200: $errText"
  $cfg = Get-Content -LiteralPath $env:ENLAZA_CONFIG -Raw -Encoding UTF8 | ConvertFrom-Json
  $context = Invoke-WebRequest -Uri "$($cfg.baseUrl)/api/rooms/$($cfg.salaId)/context?member=$([uri]::EscapeDataString($cfg.miembro))" -Headers @{ "x-room-token" = $cfg.token } -TimeoutSec 20 -UseBasicParsing
  Assert-True ($context.StatusCode -eq 200) "context $($context.StatusCode)"
  $body = $context.Content | ConvertFrom-Json
  Assert-True ([string]$body.resumen) "context sin resumen"
  Assert-True ([string]$body.parte) "context sin parte"
  $reply = @{
    text = "Respuesta de prueba del gancho de Cursor."
    conversation_id = "cursor_hook_demo"
    hook_event_name = "afterAgentResponse"
  } | ConvertTo-Json -Compress
  $reply | & (Get-Process -Id $PID).Path -NoProfile -File (Join-Path $root "enlaza-hook.ps1") -Event response > $stdoutFile 2> $stderr
  Assert-True ($LASTEXITCODE -eq 0) "respuesta en vivo no salió 0"
  Assert-True ((Get-Content -LiteralPath $stdoutFile -Raw).Trim() -eq '{}') "stdout de respuesta"
  Assert-True ((Get-Content -LiteralPath $stderr -Raw) -match 'enlaza: 200') "respuesta en vivo no dio 200"
  if ($context.Content -match [regex]::Escape($marker)) { Write-Host "CONTEXT_TIENE_EL_TEXTO" } else { Write-Host "CONTEXT_SIN_EL_TEXTO" }
  Write-Host "LIVE_OK"
  Remove-Item Env:ENLAZA_CONFIG
}

Write-Host "test ok"
exit 0
