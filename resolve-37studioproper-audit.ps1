[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ExpectedBranch = 'feature/ui-overhaul-premium-enterprise-2026-11-06'
$RepoRoot = (Get-Location).Path

function Write-LogLine {
    param([string]$Message)
    Write-Host $Message
    if ($script:ReportDir) {
        Add-Content -LiteralPath (Join-Path $script:ReportDir 'run.log') -Value $Message
    }
}

function Invoke-NpmStep {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    $logPath = Join-Path $script:ReportDir ($Name + '.log')
    $commandText = 'npm ' + ($Arguments -join ' ')
    Write-LogLine "`n=== $commandText ==="

    & npm @Arguments 2>&1 | Tee-Object -FilePath $logPath -Append
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "Command failed with exit code ${exitCode}: $commandText. See $logPath"
    }
}

function Save-NpmAudit {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [switch]$OmitDev
    )

    $arguments = @('audit', '--json')
    if ($OmitDev) { $arguments += '--omit=dev' }

    $jsonPath = Join-Path $script:ReportDir ($Name + '.json')
    $stderrPath = Join-Path $script:ReportDir ($Name + '.stderr.log')

    Write-LogLine "`n=== npm $($arguments -join ' ') (audit exit code is recorded, not treated as script failure) ==="
    $output = & npm @arguments 2> $stderrPath
    $exitCode = $LASTEXITCODE
    $output | Set-Content -LiteralPath $jsonPath -Encoding UTF8

    Write-LogLine "Audit saved: $jsonPath (npm exit code: $exitCode)"
    return [pscustomobject]@{
        Path = $jsonPath
        ExitCode = $exitCode
        StderrPath = $stderrPath
    }
}

function Get-GitOutput {
    param([string[]]$Arguments)
    $output = & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
    return ($output -join "`n").Trim()
}

if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot 'package.json'))) {
    throw "package.json was not found in the current directory: $RepoRoot"
}
if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot 'package-lock.json'))) {
    throw 'package-lock.json was not found. This script requires the committed npm lockfile.'
}

$branch = Get-GitOutput -Arguments @('branch', '--show-current')
if ($branch -ne $ExpectedBranch) {
    throw "Wrong branch '$branch'. Switch to '$ExpectedBranch' before running this script. No files were changed."
}

$porcelain = Get-GitOutput -Arguments @('status', '--porcelain')
if (-not [string]::IsNullOrWhiteSpace($porcelain)) {
    throw "Working tree is not clean. Preserve and review these local changes before running this script:`n$porcelain"
}

$head = Get-GitOutput -Arguments @('rev-parse', 'HEAD')
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$script:ReportDir = Join-Path $env:TEMP ("37studioproper-release-audit-$stamp")
New-Item -ItemType Directory -Path $script:ReportDir -Force | Out-Null

Copy-Item -LiteralPath (Join-Path $RepoRoot 'package.json') -Destination (Join-Path $script:ReportDir 'package.json.before')
Copy-Item -LiteralPath (Join-Path $RepoRoot 'package-lock.json') -Destination (Join-Path $script:ReportDir 'package-lock.json.before')

Write-LogLine "Repository: $RepoRoot"
Write-LogLine "Branch: $branch"
Write-LogLine "HEAD before changes: $head"
Write-LogLine "Backups and reports: $script:ReportDir"
Write-LogLine 'Scope: update only brace-expansion, source-map-js, and Vite. No Firebase, ESLint, minimatch, shadcn, or deepmerge changes are included.'

$script:RunStatus = 'IN_PROGRESS'
$script:Failure = $null
$auditFull = $null
$auditProd = $null

try {
    # These two transitive packages have patched versions inside the existing semver ranges.
    Invoke-NpmStep -Name '01-update-transitive-security-patches' -Arguments @(
        'update', 'brace-expansion', 'source-map-js', '--save=false'
    )

    # Vite 8.1.6 is the first patched release on the current Vite 8 line for the advisories in the supplied audit.
    Invoke-NpmStep -Name '02-update-vite-minimum-fixed-8x' -Arguments @(
        'install', '--save-dev', '--save-prefix=^', 'vite@8.1.6'
    )

    # Reinstall from the resulting lockfile to prove reproducible installation.
    Invoke-NpmStep -Name '03-clean-install' -Arguments @('ci')

    # Capture the resolved versions for review.
    Invoke-NpmStep -Name '04-resolved-package-tree' -Arguments @(
        'ls', 'brace-expansion', 'source-map-js', 'vite', '--all'
    )

    # Run all mandatory local quality gates in the order used by the release workflow.
    Invoke-NpmStep -Name '05-build' -Arguments @('run', 'build')
    Invoke-NpmStep -Name '06-lint' -Arguments @('run', 'lint')
    Invoke-NpmStep -Name '07-regression' -Arguments @('test')
    Invoke-NpmStep -Name '08-prd-security-contracts' -Arguments @('run', 'test:prd')

    # npm audit exits non-zero when findings remain; retain JSON and continue so all evidence is collected.
    $auditFull = Save-NpmAudit -Name 'npm-audit-full'
    $auditProd = Save-NpmAudit -Name 'npm-audit-production-only' -OmitDev

    $script:RunStatus = 'QUALITY_GATES_PASS'
}
catch {
    $script:RunStatus = 'STOPPED_ON_FAILURE'
    $script:Failure = $_.Exception.Message
    Write-LogLine "STOPPED: $script:Failure"
}
finally {
    # Capture both audit views even when a build or test gate fails.
    if (-not $auditFull) {
        try { $auditFull = Save-NpmAudit -Name 'npm-audit-full' }
        catch { Write-LogLine "Could not capture full npm audit: $($_.Exception.Message)" }
    }
    if (-not $auditProd) {
        try { $auditProd = Save-NpmAudit -Name 'npm-audit-production-only' -OmitDev }
        catch { Write-LogLine "Could not capture production-only npm audit: $($_.Exception.Message)" }
    }

    try {
        $newHead = Get-GitOutput -Arguments @('rev-parse', 'HEAD')
        $status = Get-GitOutput -Arguments @('status', '--short', '--branch')
        $diff = & git diff -- package.json package-lock.json
        $diff | Set-Content -LiteralPath (Join-Path $script:ReportDir 'dependency-diff.patch') -Encoding UTF8
        $stat = Get-GitOutput -Arguments @('diff', '--stat', '--', 'package.json', 'package-lock.json')
    }
    catch {
        $newHead = 'unavailable'
        $status = 'unavailable'
        $stat = 'unavailable'
    }

    $summary = @(
        '# 37Studio Proper targeted dependency audit run',
        '',
        "- Result: $script:RunStatus",
        "- Branch: $branch",
        "- HEAD before: $head",
        "- HEAD after: $newHead",
        "- Working tree after run: $status",
        "- Package diff summary: $stat",
        "- Full audit JSON: $(if ($auditFull) { $auditFull.Path } else { 'not produced; execution stopped before audit capture' })",
        "- Production-only audit JSON: $(if ($auditProd) { $auditProd.Path } else { 'not produced; execution stopped before audit capture' })",
        "- Failure: $(if ($script:Failure) { $script:Failure } else { 'none' })",
        '',
        'Targeted package actions:',
        '- `brace-expansion`: update all installed major-version branches within their existing semver ranges.',
        '- `source-map-js`: update to the patched 1.2.2 line within the existing range.',
        '- `vite`: update to 8.1.6 on the existing Vite 8 major line.',
        '',
        'Not changed:',
        '- Firebase / @grpc/grpc-js: no safe in-range upstream fix was established; do not downgrade Firebase.',
        '- minimatch / ESLint: patched minimatch is 11.x and requires scoped compatibility verification.',
        '- shadcn / deepmerge: dev-tool dependency; the deepmerge advisory currently has no patched version.',
        '',
        'Safety boundary:',
        '- This script does not stage, commit, push, open a PR, merge, deploy, or change Firebase configuration.',
        '- Backups are retained in this report folder.',
        '- If a gate fails, the updated files are intentionally left in place for inspection; no automatic reset or rollback is performed.'
    )
    $summary | Set-Content -LiteralPath (Join-Path $script:ReportDir 'SUMMARY.md') -Encoding UTF8
}

Write-Host "`nRun result: $script:RunStatus"
Write-Host "Evidence folder: $script:ReportDir"
Write-Host "Summary: $(Join-Path $script:ReportDir 'SUMMARY.md')"
Write-Host 'No commit or push was performed.'

if ($script:RunStatus -ne 'QUALITY_GATES_PASS') {
    exit 1
}

