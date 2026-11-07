[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ($PSVersionTable.PSVersion.Major -lt 7) {
    throw 'This script requires PowerShell 7 or newer.'
}

# Native process failures are evaluated only through the process exit code below.
# npm emits useful warnings on stderr even when its exit code is zero.
$PSNativeCommandUseErrorActionPreference = $false

$ExpectedBranch = 'feature/ui-overhaul-premium-enterprise-2026-11-06'
$RepoRoot = [System.IO.Path]::GetFullPath((Get-Location).Path)
$script:ReportDir = $null
$script:NpmExecutable = $null
$script:RunStatus = 'NOT_STARTED'
$script:Failure = $null

function Write-LogLine {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host $Message
    if ($script:ReportDir) {
        Add-Content -LiteralPath (Join-Path $script:ReportDir 'run.log') -Value $Message -Encoding utf8
    }
}

function Get-GitOutput {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)
    $output = & git @Arguments
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "git $($Arguments -join ' ') failed with exit code $exitCode"
    }
    return ($output -join "`n").Trim()
}

function Show-LogFile {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (Test-Path -LiteralPath $Path) {
        $content = Get-Content -LiteralPath $Path -Raw -ErrorAction Stop
        if (-not [string]::IsNullOrWhiteSpace($content)) {
            Write-Host $content.TrimEnd()
        }
    }
}

function Invoke-NpmStep {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    $stdoutPath = Join-Path $script:ReportDir ($Name + '.stdout.log')
    $stderrPath = Join-Path $script:ReportDir ($Name + '.stderr.log')
    $commandText = 'npm ' + ($Arguments -join ' ')
    Write-LogLine "`n=== $commandText ==="

    # Keep stdout and stderr separate. Never merge native stderr into a PowerShell
    # error pipeline: npm uses stderr for warnings even when the command succeeds.
    $global:LASTEXITCODE = 0
    & $script:NpmExecutable @Arguments 1> $stdoutPath 2> $stderrPath
    $exitCode = $LASTEXITCODE

    Write-Host '--- stdout ---'
    Show-LogFile -Path $stdoutPath
    Write-Host '--- stderr (informational unless exit code is non-zero) ---'
    Show-LogFile -Path $stderrPath

    if ($exitCode -ne 0) {
        throw "Command failed with exit code ${exitCode}: $commandText. See $stdoutPath and $stderrPath"
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
    Write-LogLine "`n=== npm $($arguments -join ' ') (audit findings are recorded, not treated as script failure) ==="

    $global:LASTEXITCODE = 0
    & $script:NpmExecutable @arguments 1> $jsonPath 2> $stderrPath
    $exitCode = $LASTEXITCODE
    Write-LogLine "Audit saved: $jsonPath (npm exit code: $exitCode)"
    if (Test-Path -LiteralPath $stderrPath) {
        $stderrContent = Get-Content -LiteralPath $stderrPath -Raw
        if (-not [string]::IsNullOrWhiteSpace($stderrContent)) {
            Write-LogLine "Audit stderr: $($stderrContent.Trim())"
        }
    }

    return [pscustomobject]@{
        Path = $jsonPath
        ExitCode = $exitCode
        StderrPath = $stderrPath
    }
}

function Get-LockPackageEntries {
    param([Parameter(Mandatory = $true)][string]$PackageName)

    $lockPath = Join-Path $RepoRoot 'package-lock.json'
    # package-lock.json uses an empty string key for the root package. -AsHashtable
    # is required because PSCustomObject cannot represent empty property names.
    $lock = Get-Content -LiteralPath $lockPath -Raw | ConvertFrom-Json -AsHashtable
    $packageMap = $lock['packages']
    if ($null -eq $packageMap) {
        throw 'package-lock.json does not contain a packages map. Expected npm lockfile version 2 or 3.'
    }

    $escaped = [regex]::Escape($PackageName)
    $matches = @(
        foreach ($entry in $packageMap.GetEnumerator()) {
            $entryName = [string]$entry.Key
            if ($entryName -match "(^|/)node_modules/$escaped$") {
                $entryData = $entry.Value
                $entryVersion = if ($entryData -is [System.Collections.IDictionary]) { [string]$entryData['version'] } else { '' }
                [pscustomobject]@{
                    Path = $entryName
                    Version = $entryVersion
                }
            }
        }
    )
    return $matches
}

function Assert-TargetedPatches {
    param([switch]$RequireVite)

    $braceEntries = @(Get-LockPackageEntries -PackageName 'brace-expansion')
    if ($braceEntries.Count -eq 0) {
        throw 'No brace-expansion entries were found in package-lock.json.'
    }

    $badBrace = @()
    foreach ($entry in $braceEntries) {
        $version = [version]$entry.Version
        $minimum = $null
        switch ($version.Major) {
            1 { $minimum = [version]'1.1.21' }
            2 { $minimum = [version]'2.1.7' }
            3 { $minimum = [version]'3.0.9' }
            # No fixed 4.x line exists for the current advisory; the package
            # maintainer's patched successor is 5.0.12.
            4 { $minimum = [version]'5.0.12' }
            5 { $minimum = [version]'5.0.12' }
            default { $minimum = $null }
        }
        if ($null -ne $minimum -and $version -lt $minimum) {
            $badBrace += "$($entry.Path)=$($entry.Version), minimum patched version is $minimum"
        }
    }
    if ($badBrace.Count -gt 0) {
        throw "A vulnerable brace-expansion branch remains in package-lock.json:`n$($badBrace -join "`n")"
    }

    $sourceEntries = @(Get-LockPackageEntries -PackageName 'source-map-js')
    if ($sourceEntries.Count -eq 0) {
        throw 'No source-map-js entries were found in package-lock.json.'
    }
    $badSource = @($sourceEntries | Where-Object {
        $version = [version]$_.Version
        ($version.Major -eq 1) -and ($version -lt [version]'1.2.2')
    })
    if ($badSource.Count -gt 0) {
        throw "source-map-js must be at least 1.2.2:`n$(($badSource | ForEach-Object { "$($_.Path)=$($_.Version)" }) -join "`n")"
    }

    if ($RequireVite) {
        $viteEntries = @(Get-LockPackageEntries -PackageName 'vite')
        if ($viteEntries.Count -eq 0) {
            throw 'No Vite package entry was found in package-lock.json.'
        }
        $badVite = @($viteEntries | Where-Object {
            $viteVersion = [version]$_.Version
            ($viteVersion.Major -ne 8) -or ($viteVersion -lt [version]'8.1.6')
        })
        if ($badVite.Count -gt 0) {
            throw "Vite must be 8.1.6 or later within major version 8:`n$(($badVite | ForEach-Object { "$($_.Path)=$($_.Version)" }) -join "`n")"
        }
    }

    $braceSummary = ($braceEntries | ForEach-Object { "$($_.Version) [$($_.Path)]" }) -join '; '
    $sourceSummary = ($sourceEntries | ForEach-Object { "$($_.Version) [$($_.Path)]" }) -join '; '
    Write-LogLine "Verified brace-expansion entries: $braceSummary"
    Write-LogLine "Verified source-map-js entries: $sourceSummary"
    if ($RequireVite) {
        $viteSummary = ($viteEntries | ForEach-Object { "$($_.Version) [$($_.Path)]" }) -join '; '
        Write-LogLine "Verified Vite entries: $viteSummary"
    }
}

function Test-ViteNeedsUpdate {
    $viteEntries = @(Get-LockPackageEntries -PackageName 'vite')
    if ($viteEntries.Count -eq 0) {
        throw 'No Vite package entry was found in package-lock.json.'
    }
    $badLockEntries = @($viteEntries | Where-Object {
        $viteVersion = [version]$_.Version
        ($viteVersion.Major -ne 8) -or ($viteVersion -lt [version]'8.1.6')
    })

    $manifest = Get-Content -LiteralPath (Join-Path $RepoRoot 'package.json') -Raw | ConvertFrom-Json -AsHashtable
    if (-not $manifest.Contains('devDependencies') -or -not $manifest['devDependencies'].Contains('vite')) {
        throw 'Vite is not declared in package.json devDependencies.'
    }
    $viteSpec = [string]$manifest['devDependencies']['vite']
    $manifestNeedsUpdate = $viteSpec -notmatch '^\^?8\.1\.6$'
    return [bool]($manifestNeedsUpdate -or ($badLockEntries.Count -gt 0))
}

function Assert-OnlyViteManifestChange {
    $beforePath = Join-Path $script:ReportDir 'package.json.before'
    $currentPath = Join-Path $RepoRoot 'package.json'
    $before = Get-Content -LiteralPath $beforePath -Raw | ConvertFrom-Json -AsHashtable
    $current = Get-Content -LiteralPath $currentPath -Raw | ConvertFrom-Json -AsHashtable

    if (-not $before.Contains('devDependencies') -or -not $current.Contains('devDependencies')) {
        throw 'package.json does not contain devDependencies; refusing to validate the Vite-only manifest change.'
    }
    if (-not $before['devDependencies'].Contains('vite') -or -not $current['devDependencies'].Contains('vite')) {
        throw 'Vite is not present in devDependencies; refusing to validate the manifest change.'
    }

    $current['devDependencies']['vite'] = $before['devDependencies']['vite']
    $beforeCanonical = ConvertTo-Json -InputObject $before -Depth 100 -Compress
    $currentCanonical = ConvertTo-Json -InputObject $current -Depth 100 -Compress
    if ($beforeCanonical -cne $currentCanonical) {
        throw 'package.json contains changes beyond devDependencies.vite. Preserve the current files for manual review.'
    }

    $viteSpec = [string]$((Get-Content -LiteralPath $currentPath -Raw | ConvertFrom-Json -AsHashtable)['devDependencies']['vite'])
    if ($viteSpec -notmatch '^\^?8\.1\.6$') {
        throw "Expected package.json devDependencies.vite to be ^8.1.6 or 8.1.6, found '$viteSpec'."
    }
    Write-LogLine "Verified package.json change is limited to devDependencies.vite=$viteSpec"
}

function Get-AuditCounts {
    param([string]$Path)
    if (-not $Path -or -not (Test-Path -LiteralPath $Path)) { return $null }
    try {
        # npm audit JSON can also contain empty-string keys; parse as a hashtable.
        $audit = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json -AsHashtable
        return $audit['metadata']['vulnerabilities']
    }
    catch {
        return $null
    }
}

# Repository preflight. Only untracked root-level audit helper scripts matching
# the dedicated prefix are exempted; every other local change blocks.
if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot 'package.json'))) {
    throw "package.json was not found in the current directory: $RepoRoot"
}
if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot 'package-lock.json'))) {
    throw 'package-lock.json was not found. This script requires the npm lockfile.'
}

$branch = Get-GitOutput -Arguments @('branch', '--show-current')
if ($branch -ne $ExpectedBranch) {
    throw "Wrong branch '$branch'. Expected '$ExpectedBranch'. No files were changed."
}

$scriptPath = [System.IO.Path]::GetFullPath($PSCommandPath)
$scriptDirectory = [System.IO.Path]::GetFullPath([System.IO.Path]::GetDirectoryName($scriptPath)).TrimEnd([char[]]@('\', '/'))
$repositoryDirectory = $RepoRoot.TrimEnd([char[]]@('\', '/'))
if ($scriptDirectory -ine $repositoryDirectory) {
    throw 'Place this script in the repository root and run it from the repository root. No files were changed.'
}

$scriptRelativePath = [System.IO.Path]::GetFileName($scriptPath).Replace('\', '/')
$porcelain = Get-GitOutput -Arguments @('status', '--porcelain=v1', '--untracked-files=all')
$remainingChanges = @(
    $porcelain -split '\r?\n' |
        Where-Object {
            if ([string]::IsNullOrWhiteSpace($_)) { return $false }
            $statusCode = $_.Substring(0, 2)
            $statusPath = $_.Substring(3).Trim([char]'"').Replace('\', '/')
            # Ignore only untracked root-level audit helper scripts from this
            # troubleshooting sequence, including Windows duplicate-download
            # suffixes such as " (1)". All tracked changes and all other local
            # untracked files continue to block execution.
            $isAuditHelper = $statusPath -match '^resolve-37studioproper-audit.*\.ps1$'
            -not ($statusCode -eq '??' -and $isAuditHelper)
        }
)
if ($remainingChanges.Count -gt 0) {
    throw "Working tree has other local changes. Preserve and review them before running this script:`n$($remainingChanges -join "`n")"
}

$npmCommand = Get-Command 'npm.cmd' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $npmCommand -or [string]::IsNullOrWhiteSpace($npmCommand.Source)) {
    throw 'npm.cmd was not found on PATH. No files were changed.'
}
$script:NpmExecutable = $npmCommand.Source

$head = Get-GitOutput -Arguments @('rev-parse', 'HEAD')
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$script:ReportDir = Join-Path $env:TEMP ("37studioproper-release-audit-v8-$stamp")
New-Item -ItemType Directory -Path $script:ReportDir -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $RepoRoot 'package.json') -Destination (Join-Path $script:ReportDir 'package.json.before')
Copy-Item -LiteralPath (Join-Path $RepoRoot 'package-lock.json') -Destination (Join-Path $script:ReportDir 'package-lock.json.before')

Write-LogLine "Repository: $RepoRoot"
Write-LogLine "Branch: $branch"
Write-LogLine "HEAD before changes: $head"
Write-LogLine "Backups and reports: $script:ReportDir"
Write-LogLine "npm executable: $script:NpmExecutable"
Write-LogLine 'Scope: apply npm audit fixed versions within existing semver ranges to package-lock only (no --force), then ensure Vite is 8.1.6 on the Vite 8 line. Firebase major downgrades and unrelated manifest changes are prohibited.'
Write-LogLine 'Lockfile strategy: npm audit fix --package-lock-only updates vulnerable transitive packages using npm advisory resolution. It can update multiple semver-compatible vulnerable packages; no semver-major force is used. Vite manifest change is isolated and verified separately.'
Write-LogLine 'Lifecycle script policy: no approvals or allowScripts changes are made. npm stderr warnings are logged separately and judged by process exit code.'

$script:RunStatus = 'IN_PROGRESS'
$auditFull = $null
$auditProd = $null

try {
    # npm update <transitive-package> does not reliably re-resolve a package
    # that is not a root dependency. Use npm's advisory resolver instead.
    # --package-lock-only keeps node_modules untouched, --audit-level=critical
    # lets known High/Moderate findings remain recorded without stopping a
    # successful compatible-fix pass, and no --force flag is ever supplied.
    $manifestHashBeforeAuditFix = (Get-FileHash -LiteralPath (Join-Path $RepoRoot 'package.json') -Algorithm SHA256).Hash
    Invoke-NpmStep -Name '01-npm-audit-fix-lock-only-compatible' -Arguments @(
        'audit', 'fix', '--package-lock-only', '--audit-level=critical', '--prefer-online'
    )
    $manifestHashAfterAuditFix = (Get-FileHash -LiteralPath (Join-Path $RepoRoot 'package.json') -Algorithm SHA256).Hash
    if ($manifestHashBeforeAuditFix -cne $manifestHashAfterAuditFix) {
        throw 'npm audit fix --package-lock-only unexpectedly changed package.json. Manual review required.'
    }
    Assert-TargetedPatches

    if (Test-ViteNeedsUpdate) {
        Invoke-NpmStep -Name '02-update-vite-lock-and-manifest-to-8.1.6' -Arguments @(
            'install', '--package-lock-only', '--save-dev', '--save-prefix=^', 'vite@8.1.6'
        )
    }
    Assert-TargetedPatches -RequireVite
    Assert-OnlyViteManifestChange

    Invoke-NpmStep -Name '03-clean-install' -Arguments @('ci')
    Assert-TargetedPatches -RequireVite

    Invoke-NpmStep -Name '04-resolved-package-tree' -Arguments @(
        'ls', 'brace-expansion', 'source-map-js', 'vite', '--all'
    )

    Invoke-NpmStep -Name '05-build' -Arguments @('run', 'build')
    Invoke-NpmStep -Name '06-lint' -Arguments @('run', 'lint')
    Invoke-NpmStep -Name '07-regression' -Arguments @('test')
    Invoke-NpmStep -Name '08-prd-security-contracts' -Arguments @('run', 'test:prd')

    $auditFull = Save-NpmAudit -Name 'npm-audit-full'
    $auditProd = Save-NpmAudit -Name 'npm-audit-production-only' -OmitDev

    $fullCounts = Get-AuditCounts -Path $auditFull.Path
    $prodCounts = Get-AuditCounts -Path $auditProd.Path
    if ($null -eq $fullCounts -or $null -eq $prodCounts) {
        $script:RunStatus = 'QUALITY_GATES_PASS_AUDIT_PARSE_REVIEW_REQUIRED'
    }
    elseif ([int]$prodCounts.total -gt 0) {
        $script:RunStatus = 'QUALITY_GATES_PASS_PRODUCTION_SECURITY_HOLD'
    }
    elseif ([int]$fullCounts.total -gt 0) {
        $script:RunStatus = 'QUALITY_GATES_PASS_DEV_AUDIT_REVIEW_REQUIRED'
    }
    else {
        $script:RunStatus = 'QUALITY_GATES_PASS_AUDIT_CLEAR'
    }
}
catch {
    $script:RunStatus = 'STOPPED_ON_FAILURE'
    $script:Failure = $_.Exception.Message
    Write-LogLine "STOPPED: $script:Failure"
}
finally {
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
        $diff | Set-Content -LiteralPath (Join-Path $script:ReportDir 'dependency-diff.patch') -Encoding utf8
        $stat = Get-GitOutput -Arguments @('diff', '--stat', '--', 'package.json', 'package-lock.json')
    }
    catch {
        $newHead = 'unavailable'
        $status = 'unavailable'
        $stat = 'unavailable'
    }

    $fullCounts = if ($auditFull) { Get-AuditCounts -Path $auditFull.Path } else { $null }
    $prodCounts = if ($auditProd) { Get-AuditCounts -Path $auditProd.Path } else { $null }
    $fullCountText = if ($null -ne $fullCounts) { "low=$($fullCounts['low']), moderate=$($fullCounts['moderate']), high=$($fullCounts['high']), critical=$($fullCounts['critical']), total=$($fullCounts['total'])" } else { 'unavailable' }
    $prodCountText = if ($null -ne $prodCounts) { "low=$($prodCounts['low']), moderate=$($prodCounts['moderate']), high=$($prodCounts['high']), critical=$($prodCounts['critical']), total=$($prodCounts['total'])" } else { 'unavailable' }

    $summary = @(
        '# 37Studio Proper targeted dependency audit run (V8)',
        '',
        "- Result: $script:RunStatus",
        "- Branch: $branch",
        "- HEAD before: $head",
        "- HEAD after: $newHead",
        "- Working tree after run: $status",
        "- Package diff summary: $stat",
        "- Full audit counts: $fullCountText",
        "- Production-only audit counts: $prodCountText",
        "- Full audit JSON: $(if ($auditFull) { $auditFull.Path } else { 'not produced' })",
        "- Production-only audit JSON: $(if ($auditProd) { $auditProd.Path } else { 'not produced' })",
        "- Failure: $(if ($script:Failure) { $script:Failure } else { 'none' })",
        '',
        'Security update actions:',
        '- `npm audit fix --package-lock-only --audit-level=critical` resolves all npm-auditable issues that have compatible fixes in existing semver ranges; no `--force` is used.',
        '- Verify `brace-expansion` patched branches, `source-map-js` 1.2.2 or later, and Vite 8.1.6 or later.',
        '- If Vite is still below 8.1.6, update only `devDependencies.vite` and its lock entry to the Vite 8.1.6 line.',
        '',
        'Boundaries:',
        '- The audit-fix stage must leave package.json byte-identical. Afterward, only devDependencies.vite may change in package.json.',
        '- No semver-major forced updates, Firebase downgrade, lifecycle script approvals, or allowScripts policy changes.',
        '',
        'Safety boundary:',
        '- This script does not stage, commit, push, open a PR, merge, deploy, or change Firebase configuration.',
        '- Backups, stdout/stderr logs, audits, and dependency diff are retained in this report folder.',
        '- Any failed gate leaves the current package files in place for inspection; no automatic reset or rollback is performed.',
        '- V8 uses npm audit fix rather than npm update <transitive-package>, which had returned up to date without moving the nested brace-expansion branch.',
        '- Quality gate success does not mean release approval when production audit findings remain.'
    )
    $summary | Set-Content -LiteralPath (Join-Path $script:ReportDir 'SUMMARY.md') -Encoding utf8
}

Write-Host "`nRun result: $script:RunStatus"
Write-Host "Evidence folder: $script:ReportDir"
Write-Host "Summary: $(Join-Path $script:ReportDir 'SUMMARY.md')"
Write-Host 'No commit or push was performed.'

if ($script:RunStatus -eq 'STOPPED_ON_FAILURE') { exit 1 }
if ($script:RunStatus -ne 'QUALITY_GATES_PASS_AUDIT_CLEAR') { exit 2 }
exit 0
