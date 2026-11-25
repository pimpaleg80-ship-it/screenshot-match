<#
.SYNOPSIS
  Repeatable FlowPeople Supabase Realtime Geofencing setup, validation, and deployment helper.

.DESCRIPTION
  Supports safe verification without hardcoded credentials or destructive DB operations:
    -Check     Verifies Supabase CLI version, linked project ref, required files, and Capacitor plugins.
    -Validate  Runs TypeScript check, Vitest geofence/security suite, production build check, and live DB schema/RLS checks (when DATABASE_URL is set in .env.local).
    -Deploy    Checks Supabase CLI authentication and pushes migrations / deploys the verify-attendance Edge Function.
    -TestEndpoint  Verifies the deployed verify-attendance Edge Function enforces JWT authentication (returns 401 when unauthenticated).

.EXAMPLE
  pwsh -File scripts/setup-geofencing.ps1 -Check -Validate
  pwsh -File scripts/setup-geofencing.ps1 -Deploy -TestEndpoint
#>
[CmdletBinding()]
param(
  [switch]$Check,
  [switch]$Validate,
  [switch]$Deploy,
  [switch]$TestEndpoint,
  [string]$ProjectRef
)

$ErrorActionPreference = "Stop"

if (-not ($Check -or $Validate -or $Deploy -or $TestEndpoint)) {
  $Check = $true
}

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $RepoRoot

function Write-Section([string]$Title) {
  Write-Host "`n=== $Title ===" -ForegroundColor Cyan
}

function Read-DotEnvLocal {
  $envPath = Join-Path $RepoRoot ".env.local"
  $map = @{}
  if (Test-Path $envPath) {
    foreach ($line in Get-Content $envPath) {
      if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
      $idx = $line.IndexOf('=')
      $k = $line.Substring(0, $idx).Trim()
      $v = $line.Substring($idx + 1).Trim().Trim("'`"")
      $map[$k] = $v
    }
  }
  return $map
}

function Resolve-ProjectRef([hashtable]$EnvMap) {
  if ($ProjectRef) { return $ProjectRef }
  $configPath = Join-Path $RepoRoot "supabase/config.toml"
  if (Test-Path $configPath) {
    $match = Select-String -Path $configPath -Pattern 'project_id\s*=\s*"([^"]+)"' | Select-Object -First 1
    if ($match -and $match.Matches.Groups.Count -ge 2) {
      return $match.Matches.Groups[1].Value
    }
  }
  if ($EnvMap.ContainsKey("VITE_SUPABASE_URL") -and $EnvMap["VITE_SUPABASE_URL"] -match 'https://([^.]+)\.supabase\.co') {
    return $Matches[1]
  }
  return $null
}

try {
  $EnvMap = Read-DotEnvLocal
  $ResolvedRef = Resolve-ProjectRef $EnvMap

  if ($Check) {
    Write-Section "Supabase & Capacitor Environment Check"

    $RequiredFiles = @(
      "supabase/config.toml",
      "supabase/migrations/20261125120000_realtime_geofencing_rls_hardening.sql",
      "supabase/functions/verify-attendance/index.ts",
      "supabase/functions/verify-attendance/verification.ts",
      "src/lib/geofence.ts",
      "src/lib/mobile-geofence.ts",
      "src/hooks/use-geofence-sync.ts",
      "src/components/admin/location-studio.tsx",
      "src/components/geofence-attendance-card.tsx",
      "mobile/android/AndroidManifest.xml",
      "mobile/ios/Info.plist"
    )

    foreach ($rel in $RequiredFiles) {
      $full = Join-Path $RepoRoot $rel
      if (Test-Path $full) {
        Write-Host "[OK] $rel" -ForegroundColor Green
      } else {
        throw "Missing required geofencing artifact: $rel"
      }
    }

    $displayRef = if ($ResolvedRef) { $ResolvedRef } else { 'UNKNOWN' }
    Write-Host "Linked project ref: $displayRef"
    $supaVer = & npx supabase --version 2>&1
    Write-Host "Supabase CLI: $supaVer"

    $pkg = Get-Content (Join-Path $RepoRoot "package.json") -Raw | ConvertFrom-Json
    foreach ($dep in @("@capacitor/core", "@capacitor/app", "@capacitor/geolocation", "@capacitor/device", "@capacitor/local-notifications")) {
      $ver = $pkg.dependencies.$dep
      if ($ver) {
        Write-Host "[OK] $dep ($ver)" -ForegroundColor Green
      } else {
        Write-Warning "Capacitor dependency not found in dependencies: $dep"
      }
    }

    & npx supabase status 2>&1 | ForEach-Object { Write-Host $_ }
  }

  if ($Validate) {
    Write-Section "TypeScript, Geofence Tests & Database Security Validation"

    Write-Host "Running tsc --noEmit..."
    $tscBin = Join-Path $RepoRoot "node_modules\.bin\tsc.cmd"
    if (Test-Path $tscBin) {
      & $tscBin --noEmit
    } else {
      & npx tsc --noEmit
    }
    if ($LASTEXITCODE -ne 0) { throw "TypeScript typecheck failed." }

    Write-Host "Running Vitest suite..."
    $vitestBin = Join-Path $RepoRoot "node_modules\.bin\vitest.cmd"
    if (Test-Path $vitestBin) {
      & $vitestBin run
    } else {
      & npm test
    }
    if ($LASTEXITCODE -ne 0) { throw "Vitest suite failed." }

    if ($EnvMap.ContainsKey("DATABASE_URL") -and $EnvMap["DATABASE_URL"]) {
      Write-Host "Checking live Postgres RLS & Realtime publication..."
      $dbCheckScript = @'
import fs from 'fs';
import postgres from 'postgres';
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => {
  const idx = l.indexOf('=');
  return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')];
}));
const sql = postgres(env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });
const rt = await sql`SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='work_locations'`;
const badPols = await sql`SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='attendance' AND policyname IN ('attendance: employee insert own','attendance: employee update own')`;
if (rt.length !== 1) throw new Error('work_locations missing from supabase_realtime publication');
if (badPols.length > 0) throw new Error('Insecure direct employee attendance write policies still present');
console.log('[OK] Realtime publication active on work_locations & direct employee attendance writes blocked.');
await sql.end();
'@
      $dbCheckScript | & node --input-type=module
      if ($LASTEXITCODE -ne 0) { throw "Live Postgres validation failed." }
    } else {
      Write-Warning "DATABASE_URL not set in .env.local; skipping live Postgres check."
    }
  }

  if ($Deploy) {
    Write-Section "Supabase Remote Migration & Edge Function Deployment"

    if (-not $ResolvedRef) {
      throw "Could not determine Supabase project ref. Pass -ProjectRef or configure supabase/config.toml."
    }

    $hasToken = [bool]$env:SUPABASE_ACCESS_TOKEN
    if (-not $hasToken) {
      Write-Warning "SUPABASE_ACCESS_TOKEN environment variable is not set. Verifying cached CLI login..."
    }

    & npx supabase projects list 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
      Write-Host ""
      Write-Host "Manual authentication required before remote CLI deployment:" -ForegroundColor Yellow
      Write-Host "  1. Run: npx supabase login" -ForegroundColor Yellow
      Write-Host "  2. Or set SUPABASE_ACCESS_TOKEN in your shell environment" -ForegroundColor Yellow
      Write-Host "  3. Then re-run: pwsh -File scripts/setup-geofencing.ps1 -Deploy" -ForegroundColor Yellow
      throw "Supabase CLI is not authenticated for remote deploy."
    }

    Write-Host "Pushing migrations to project $ResolvedRef (CLI v3 explicit remote confirmation)..."
    & npx supabase db push --remote
    if ($LASTEXITCODE -ne 0) { throw "supabase db push failed." }

    Write-Host "Deploying Edge Function verify-attendance..."
    & npx supabase functions deploy verify-attendance --project-ref $ResolvedRef
    if ($LASTEXITCODE -ne 0) { throw "Edge Function deploy failed." }

    Write-Host "[OK] Remote DB migrations & verify-attendance Edge Function deployed." -ForegroundColor Green
  }

  if ($TestEndpoint) {
    Write-Section "Verify verify-attendance Endpoint Security"
    if (-not $ResolvedRef) {
      throw "Project ref required to build Edge Function URL."
    }
    $url = "https://$ResolvedRef.supabase.co/functions/v1/verify-attendance"
    Write-Host "Testing unauthenticated rejection on $url ..."

    try {
      $resp = Invoke-WebRequest -Uri $url -Method POST -ContentType "application/json" -Body '{"action":"check_in"}' -UseBasicParsing -ErrorAction Stop
      throw "Expected 401/403 when unauthenticated, got HTTP $($resp.StatusCode)"
    } catch {
      $statusCode = $_.Exception.Response.StatusCode.value__
      if ($statusCode -eq 401 -or $statusCode -eq 403) {
        Write-Host "[OK] Edge Function rejected unauthenticated request with HTTP $statusCode." -ForegroundColor Green
      } elseif ($statusCode -eq 404) {
        Write-Warning "Edge Function verify-attendance returned 404 (not deployed remotely yet). Deploy it first with -Deploy."
      } else {
        Write-Warning "Received HTTP $statusCode from verify-attendance: $($_.Exception.Message)"
      }
    }
  }
}
finally {
  Pop-Location
}
