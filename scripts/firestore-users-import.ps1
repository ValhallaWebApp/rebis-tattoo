param(
  [string]$ProjectId = "",
  [string]$InputFile = "firestore-users.mock.json",
  [string]$Collection = "users",
  [string[]]$UserIds = @(),
  [int]$MaxRetries = 3,
  [int]$RetryDelayMs = 800,
  [switch]$DryRun
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

function Resolve-AccessToken {
  $cfgPath = Join-Path $env:USERPROFILE ".config\configstore\firebase-tools.json"
  if (-not (Test-Path $cfgPath)) {
    throw "Config Firebase CLI non trovata: $cfgPath. Esegui 'firebase login --reauth'."
  }

  $cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
  $token = ""
  if ($null -ne $cfg -and $null -ne $cfg.tokens -and $null -ne $cfg.tokens.access_token) {
    $token = [string]$cfg.tokens.access_token
  }
  $expiresAtRaw = $cfg.tokens.expires_at

  if (-not $token) {
    throw "Access token Firebase CLI mancante. Esegui 'firebase login --reauth'."
  }

  if ($expiresAtRaw) {
    $expiresAtMs = [int64]$expiresAtRaw
    $nowMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    if ($expiresAtMs -lt ($nowMs + 60000)) {
      throw "Access token Firebase CLI scaduto o in scadenza. Esegui 'firebase login --reauth'."
    }
  }

  return $token
}

function Convert-ToFirestoreValue {
  param([Parameter(ValueFromPipeline = $true)]$Value)

  if ($null -eq $Value) {
    return @{ nullValue = $null }
  }

  if ($Value -is [bool]) {
    return @{ booleanValue = $Value }
  }

  if (
    $Value -is [byte] -or $Value -is [sbyte] -or
    $Value -is [int16] -or $Value -is [uint16] -or
    $Value -is [int32] -or $Value -is [uint32] -or
    $Value -is [int64] -or $Value -is [uint64]
  ) {
    return @{ integerValue = [string]$Value }
  }

  if ($Value -is [single] -or $Value -is [double] -or $Value -is [decimal]) {
    return @{ doubleValue = [double]$Value }
  }

  if ($Value -is [string]) {
    return @{ stringValue = [string]$Value }
  }

  if ($Value -is [datetime]) {
    return @{ timestampValue = ([DateTime]$Value).ToUniversalTime().ToString("o") }
  }

  if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string]) -and -not ($Value -is [hashtable])) {
    $vals = @()
    foreach ($item in $Value) {
      $vals += ,(Convert-ToFirestoreValue $item)
    }
    return @{ arrayValue = @{ values = $vals } }
  }

  $fields = @{}

  if ($Value -is [hashtable]) {
    foreach ($k in $Value.Keys) {
      $fields[[string]$k] = Convert-ToFirestoreValue $Value[$k]
    }
    return @{ mapValue = @{ fields = $fields } }
  }

  if ($Value -is [pscustomobject]) {
    foreach ($p in $Value.PSObject.Properties) {
      $fields[[string]$p.Name] = Convert-ToFirestoreValue $p.Value
    }
    return @{ mapValue = @{ fields = $fields } }
  }

  return @{ stringValue = [string]$Value }
}

if (-not (Test-Path $InputFile)) {
  throw "File input non trovato: $InputFile"
}

$resolvedProjectId = Resolve-ProjectId -ExplicitProjectId $ProjectId
$input = Get-Content $InputFile -Raw | ConvertFrom-Json
$users = @($input.users)

if (-not $users -or $users.Count -eq 0) {
  throw "Nessun utente trovato in '$InputFile' (atteso: { `"users`": [...] })."
}

$token = Resolve-AccessToken
$baseUrl = "https://firestore.googleapis.com/v1/projects/$resolvedProjectId/databases/(default)/documents/$Collection"
$headers = @{
  Authorization = "Bearer $token"
}

Write-Host "Import Firestore collection: $Collection"
Write-Host "Project: $resolvedProjectId"
Write-Host "Input: $InputFile"
Write-Host "DryRun: $DryRun"

$ok = 0
$failed = 0

if ($UserIds.Count -eq 1 -and [string]$UserIds[0] -match ",") {
  $UserIds = [string]$UserIds[0] -split "," | ForEach-Object { $_.Trim() } | Where-Object { $_ }
}

foreach ($user in $users) {
  $id = ""
  if ($null -ne $user.id -and [string]$user.id -ne "") {
    $id = [string]$user.id
  } elseif ($null -ne $user.uid -and [string]$user.uid -ne "") {
    $id = [string]$user.uid
  }
  if ($UserIds.Count -gt 0 -and -not ($UserIds -contains $id)) {
    continue
  }

  if (-not $id) {
    Write-Warning "Record saltato: id/uid mancante."
    $failed++
    continue
  }

  $docData = @{}
  foreach ($p in $user.PSObject.Properties) {
    $docData[[string]$p.Name] = $p.Value
  }
  $docData["id"] = $id

  $fields = @{}
  foreach ($k in $docData.Keys) {
    $fields[[string]$k] = Convert-ToFirestoreValue $docData[$k]
  }

  $body = @{
    fields = $fields
  } | ConvertTo-Json -Depth 100 -Compress

  $docUri = "$baseUrl/$id"

  if ($DryRun) {
    Write-Host "[DRY] PATCH $docUri"
    $ok++
    continue
  }

  $done = $false
  for ($attempt = 1; $attempt -le $MaxRetries; $attempt++) {
    try {
      Invoke-RestMethod -Method Patch -Uri $docUri -Headers $headers -ContentType "application/json; charset=utf-8" -Body $body | Out-Null
      Write-Host "[OK] $id (attempt $attempt/$MaxRetries)"
      $ok++
      $done = $true
      break
    } catch {
      $msg = $_.Exception.Message
      if ($attempt -lt $MaxRetries) {
        Write-Warning "[RETRY] $id (attempt $attempt/$MaxRetries) -> $msg"
        Start-Sleep -Milliseconds $RetryDelayMs
      } else {
        Write-Warning "[FAIL] $id -> $msg"
        $failed++
      }
    }
  }
}

Write-Host "Completato. Successi: $ok, Falliti: $failed"
if ($failed -gt 0) {
  throw "Import Firestore completato con errori."
}
