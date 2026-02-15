param(
  [string]$ProjectId = "",
  [string]$OutFile = ""
)

$ErrorActionPreference = "Stop"

function Resolve-ProjectId {
  param([string]$ExplicitProjectId)
  if ($ExplicitProjectId) { return $ExplicitProjectId }

  if (Test-Path ".firebaserc") {
    $cfg = Get-Content ".firebaserc" -Raw | ConvertFrom-Json
    if ($cfg.projects.default) { return [string]$cfg.projects.default }
  }
  throw "ProjectId non trovato. Passa -ProjectId oppure configura .firebaserc"
}

function Resolve-FirebaseBin {
  if (Get-Command "firebase.cmd" -ErrorAction SilentlyContinue) { return "firebase.cmd" }
  if (Get-Command "firebase" -ErrorAction SilentlyContinue) { return "firebase" }
  throw "Firebase CLI non trovata nel PATH"
}

$resolvedProjectId = Resolve-ProjectId -ExplicitProjectId $ProjectId
$firebaseBin = Resolve-FirebaseBin

if (-not $OutFile) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $OutFile = "firebase-rtdb-export.live.$stamp.json"
}

Write-Host "Export RTDB project: $resolvedProjectId"
Write-Host "Output: $OutFile"

$env:FIREBASE_SKIP_UPDATE_CHECK = "true"
$env:CI = "true"

$output = & $firebaseBin database:get / --project $resolvedProjectId 2>&1
if ($LASTEXITCODE -ne 0) {
  $details = ($output | Out-String).Trim()
  throw "Export Firebase fallito (exit code $LASTEXITCODE).`n$details"
}

$json = ($output | Out-String)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path (Get-Location) $OutFile), $json, $utf8NoBom)

Write-Host "Export completato."
