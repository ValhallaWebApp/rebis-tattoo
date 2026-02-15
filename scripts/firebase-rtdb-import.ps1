param(
  [string]$ProjectId = "",
  [string]$InputFile = "firebase-rtdb-export.mock.safe.json"
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

if (-not (Test-Path $InputFile)) {
  throw "File input non trovato: $InputFile"
}

$resolvedProjectId = Resolve-ProjectId -ExplicitProjectId $ProjectId
$firebaseBin = Resolve-FirebaseBin

Write-Host "Import RTDB project: $resolvedProjectId"
Write-Host "Input: $InputFile"

$env:FIREBASE_SKIP_UPDATE_CHECK = "true"
$env:CI = "true"

$output = & $firebaseBin database:set / $InputFile --project $resolvedProjectId 2>&1
if ($LASTEXITCODE -ne 0) {
  $details = ($output | Out-String).Trim()
  throw "Import Firebase fallito (exit code $LASTEXITCODE).`n$details"
}

Write-Host "Import completato."
