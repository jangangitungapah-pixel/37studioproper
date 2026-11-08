#requires -Version 5.1
<#
.SYNOPSIS
  Publishes only the Customer Follow-up read rules to the existing production
  Firestore Security Rules release, preserving every other active production rule.

.DESCRIPTION
  This is a narrowly scoped production hotfix. It reads the currently deployed
  ruleset through the Firebase Rules REST API, inserts the two canonical
  Customer Follow-up rules from the repository source, creates a validated
  immutable ruleset, and updates the default Firestore release only after an
  explicit typed confirmation.

  It does NOT deploy the full repository firestore.rules file. That file contains
  additional booking, bookkeeping, inventory, maintenance, and procurement rule
  changes that are intentionally outside this hotfix.

  No Cloud Billing account, Blaze upgrade, Free Trial, ADC setup, or payment
  method is required. The script uses the currently active gcloud user session.

.NOTES
  Run from the repository root:
    .\scripts\deploy-customer-follow-up-rules-hotfix.ps1

  The Firebase Rules API must already be enabled. This script never enables APIs.
#>

[CmdletBinding()]
param(
    [ValidateSet("studio-proper")]
    [string]$ProjectId = "studio-proper"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Stop-WithMessage([string]$Message) {
    Write-Host ([Environment]::NewLine + "STOP: $Message") -ForegroundColor Red
    exit 1
}

function Invoke-FirebaseRulesRequest {
    param(
        [Parameter(Mandatory = $true)][ValidateSet("GET", "POST", "PATCH")][string]$Method,
        [Parameter(Mandatory = $true)][string]$Uri,
        [Parameter(Mandatory = $true)][hashtable]$Headers,
        [object]$Body
    )

    $parameters = @{
        Method = $Method
        Uri = $Uri
        Headers = $Headers
        ErrorAction = "Stop"
    }

    if ($null -ne $Body) {
        $parameters.ContentType = "application/json; charset=utf-8"
        $parameters.Body = $Body | ConvertTo-Json -Depth 30 -Compress
    }

    try {
        return Invoke-RestMethod @parameters
    }
    catch {
        $details = $_.ErrorDetails.Message
        if ([string]::IsNullOrWhiteSpace($details)) {
            $details = $_.Exception.Message
        }
        throw "$Method $Uri gagal: $details"
    }
}

$repoRoot = (& git rev-parse --show-toplevel 2>$null | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($repoRoot)) {
    Stop-WithMessage "Git repository tidak terdeteksi. Jalankan dari root 37studioproper."
}

$rulesPath = Join-Path $repoRoot "firestore.rules"
if (-not (Test-Path -LiteralPath $rulesPath)) {
    Stop-WithMessage "firestore.rules tidak ditemukan di root repository."
}

Write-Host ([Environment]::NewLine + "=== 1. VERIFY LOCAL RULE CONTRACT ===") -ForegroundColor Cyan

$localRules = Get-Content -LiteralPath $rulesPath -Raw

$taskRule = @'
    match /customerFollowUpTasks/{taskId} {
      allow read: if isApproved() && canAccessCustomerData();
      allow create, update, delete: if false;
    }
'@

$eventRule = @'
    match /customerFollowUpEvents/{eventId} {
      allow read: if isApproved() && canAccessCustomerData();
      allow create, update, delete: if false;
    }
'@

if (-not $localRules.Contains($taskRule)) {
    Stop-WithMessage "Rule customerFollowUpTasks di firestore.rules tidak sama dengan kontrak yang disetujui."
}
if (-not $localRules.Contains($eventRule)) {
    Stop-WithMessage "Rule customerFollowUpEvents di firestore.rules tidak sama dengan kontrak yang disetujui."
}

Write-Host "Local rules contain both exact read-only follow-up rules."

Write-Host ([Environment]::NewLine + "=== 2. RUN FIRESTORE EMULATOR RULE TESTS ===") -ForegroundColor Cyan

$firebaseCli = Get-Command firebase -ErrorAction SilentlyContinue
if (-not $firebaseCli) {
    Stop-WithMessage "Firebase CLI tidak ditemukan. Pasang/login Firebase CLI terlebih dahulu; script belum mengubah Firebase."
}

& npm run test:rules
$testExitCode = $LASTEXITCODE
if ($testExitCode -ne 0) {
    Stop-WithMessage "npm run test:rules gagal (exit code $testExitCode). Tidak ada ruleset produksi yang dibuat atau dipublikasikan."
}

Write-Host ([Environment]::NewLine + "=== 3. VERIFY GCLOUD USER AND API ===") -ForegroundColor Cyan

$accountOutput = & gcloud auth list --filter="status:ACTIVE" --format="value(account)" 2>&1
if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage "Tidak dapat membaca akun gcloud aktif: $($accountOutput | Out-String)"
}

$activeAccount = ($accountOutput | Out-String).Trim()
if ([string]::IsNullOrWhiteSpace($activeAccount)) {
    Stop-WithMessage "Tidak ada akun gcloud aktif. Login menggunakan akun yang memiliki izin Firebase Rules."
}

Write-Host "Active gcloud account: $activeAccount"

$enabledApis = & gcloud services list --enabled "--project=$ProjectId" --format="value(config.name)" 2>&1
if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage "Tidak dapat membaca enabled APIs: $($enabledApis | Out-String)"
}

$rulesApiEnabled = @(
    $enabledApis | Where-Object {
        ([string]$_).Trim() -eq "firebaserules.googleapis.com"
    }
).Count -gt 0

if (-not $rulesApiEnabled) {
    Stop-WithMessage "firebaserules.googleapis.com belum aktif. Script tidak akan mengaktifkan API."
}

$tokenOutput = & gcloud auth print-access-token 2>&1
if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage "Tidak dapat mengambil access token dari sesi gcloud: $($tokenOutput | Out-String)"
}

$token = ($tokenOutput | Out-String).Trim()
if ([string]::IsNullOrWhiteSpace($token)) {
    Stop-WithMessage "Access token kosong."
}

$apiRoot = "https://firebaserules.googleapis.com/v1"
$headers = @{
    Authorization = "Bearer $token"
    "x-goog-user-project" = $ProjectId
}

Write-Host "Rules API enabled. User token acquired without displaying it."

Write-Host ([Environment]::NewLine + "=== 4. READ CURRENT PRODUCTION RELEASE ===") -ForegroundColor Cyan

$releaseUri = "$apiRoot/projects/$ProjectId/releases/cloud.firestore/(default)"
$release = Invoke-FirebaseRulesRequest -Method GET -Uri $releaseUri -Headers $headers

if ([string]::IsNullOrWhiteSpace([string]$release.rulesetName)) {
    Stop-WithMessage "Release Firestore default tidak memiliki rulesetName."
}

Write-Host "Current release: $($release.name)"
Write-Host "Current ruleset: $($release.rulesetName)"
Write-Host "Last updated: $($release.updateTime)"

$rulesetUri = "$apiRoot/$($release.rulesetName)"
$currentRuleset = Invoke-FirebaseRulesRequest -Method GET -Uri $rulesetUri -Headers $headers

$ruleFiles = @($currentRuleset.source.files)
$firestoreRuleFiles = @(
    $ruleFiles | Where-Object {
        ([string]$_.name) -match '(^|/)firestore\.rules$'
    }
)

if ($firestoreRuleFiles.Count -ne 1) {
    Stop-WithMessage "Expected exactly one active firestore.rules source file; found $($firestoreRuleFiles.Count). No changes made."
}

$activeRuleFile = $firestoreRuleFiles[0]
$activeContent = [string]$activeRuleFile.content

if ($activeContent -notmatch '(?m)^\s*function isApproved\(\)\s*\{') {
    Stop-WithMessage "Production rules do not contain the expected isApproved() helper. Manual review required."
}
if ($activeContent -notmatch '(?m)^\s*function canAccessCustomerData\(\)\s*\{') {
    Stop-WithMessage "Production rules do not contain the expected canAccessCustomerData() helper. Manual review required."
}

$hasTaskRule = $activeContent -match '(?m)^[ \t]*match /customerFollowUpTasks/\{'
$hasEventRule = $activeContent -match '(?m)^[ \t]*match /customerFollowUpEvents/\{'

if ($hasTaskRule -or $hasEventRule) {
    if ($hasTaskRule -and $hasEventRule) {
        Write-Host "Both follow-up collection rules already exist in the active production ruleset." -ForegroundColor Green
        Write-Host "No new ruleset was created and no production change was made."
        exit 0
    }

    Stop-WithMessage "Only one follow-up collection rule exists in production. Partial state requires manual review; no change made."
}

$fallbackPattern = '(?m)^[ \t]*match /\{document=\*\*\} \{'
$fallbackMatches = [regex]::Matches($activeContent, $fallbackPattern)

if ($fallbackMatches.Count -ne 1) {
    Stop-WithMessage "Expected exactly one final deny-all fallback rule; found $($fallbackMatches.Count). No change made."
}

$newline = [Environment]::NewLine
$insertion = "$taskRule$newline$newline$eventRule$newline$newline"
$patchedContent = $activeContent.Insert($fallbackMatches[0].Index, $insertion)

if ($patchedContent.Length -le $activeContent.Length) {
    Stop-WithMessage "Patched rules source is not larger than the active source. No change made."
}

Write-Host "Production baseline loaded: $($activeContent.Length) characters."
Write-Host "Prepared minimal patch: +$($patchedContent.Length - $activeContent.Length) characters."
Write-Host "All existing production rules will be preserved."

Write-Host ([Environment]::NewLine + "=== 5. EXPLICIT PRODUCTION DEPLOYMENT APPROVAL ===") -ForegroundColor Yellow
Write-Host "Target project : $ProjectId"
Write-Host "Target release : cloud.firestore/(default)"
Write-Host "Scope          : add read-only rules for customerFollowUpTasks and customerFollowUpEvents only"
Write-Host "Not included   : inventory, procurement, maintenance, bookkeeping, booking, Hosting, Worker, or indexes"
Write-Host "Billing        : no billing, no Blaze, no Free Trial, no payment method"
Write-Host ""

$requiredConfirmation = "DEPLOY FOLLOW-UP RULES TO $ProjectId"
$confirmation = Read-Host "Type exactly: $requiredConfirmation"

if ($confirmation -cne $requiredConfirmation) {
    Write-Host "Cancelled. No ruleset was created or published." -ForegroundColor Yellow
    exit 0
}

Write-Host ([Environment]::NewLine + "=== 6. CREATE VALIDATED IMMUTABLE RULESET ===") -ForegroundColor Cyan

$updatedFiles = @(
    foreach ($file in $ruleFiles) {
        if ([string]$file.name -eq [string]$activeRuleFile.name) {
            @{
                name = [string]$file.name
                content = $patchedContent
            }
        }
        else {
            @{
                name = [string]$file.name
                content = [string]$file.content
            }
        }
    }
)

$createBody = @{
    source = @{
        files = $updatedFiles
    }
}

$newRuleset = Invoke-FirebaseRulesRequest -Method POST -Uri "$apiRoot/projects/$ProjectId/rulesets" -Headers $headers -Body $createBody

if ([string]::IsNullOrWhiteSpace([string]$newRuleset.name)) {
    Stop-WithMessage "Ruleset API tidak mengembalikan nama ruleset. Release produksi belum diubah."
}

Write-Host "Validated ruleset created: $($newRuleset.name)"
Write-Host "Creating a ruleset does not make it active."

Write-Host ([Environment]::NewLine + "=== 7. PUBLISH TO DEFAULT FIRESTORE RELEASE ===") -ForegroundColor Cyan

$releaseUpdateBody = @{
    release = @{
        name = [string]$release.name
        rulesetName = [string]$newRuleset.name
    }
}

$published = Invoke-FirebaseRulesRequest -Method PATCH -Uri $releaseUri -Headers $headers -Body $releaseUpdateBody

$verifiedRelease = Invoke-FirebaseRulesRequest -Method GET -Uri $releaseUri -Headers $headers

if ([string]$verifiedRelease.rulesetName -ne [string]$newRuleset.name) {
    Stop-WithMessage "Release verification mismatch. Expected $($newRuleset.name), found $($verifiedRelease.rulesetName)."
}

Write-Host ([Environment]::NewLine + "=== 8. VERIFY ACTIVE RULESET CONTENT ===") -ForegroundColor Green

$verifiedRuleset = Invoke-FirebaseRulesRequest -Method GET -Uri "$apiRoot/$($verifiedRelease.rulesetName)" -Headers $headers

$verifiedFile = @(
    $verifiedRuleset.source.files |
    Where-Object { ([string]$_.name) -eq [string]$activeRuleFile.name } |
    Select-Object -First 1
)

if ($verifiedFile.Count -ne 1) {
    Stop-WithMessage "Published ruleset source could not be read back."
}

$verifiedContent = [string]$verifiedFile[0].content

$result = [PSCustomObject]@{
    Project = $ProjectId
    ActiveAccount = $activeAccount
    Release = $verifiedRelease.name
    PreviousRuleset = $release.rulesetName
    ActiveRuleset = $verifiedRelease.rulesetName
    TasksReadRulePresent = ($verifiedContent -match '(?m)^[ \t]*match /customerFollowUpTasks/\{')
    EventsReadRulePresent = ($verifiedContent -match '(?m)^[ \t]*match /customerFollowUpEvents/\{')
    RulesReleaseUpdated = $verifiedRelease.updateTime
    BillingPlanChanged = $false
    HostingDeployed = $false
    WorkerDeployed = $false
}

$result | Format-List

if (-not $result.TasksReadRulePresent -or -not $result.EventsReadRulePresent) {
    Stop-WithMessage "Post-deploy content verification failed. Keep the previous ruleset name for rollback review."
}

Write-Host ([Environment]::NewLine + "Deployment completed. Firestore Security Rules can take several minutes to propagate.") -ForegroundColor Green
Write-Host "Wait for propagation before retrying the Follow-up Center. No Hosting or Worker deployment was performed."
