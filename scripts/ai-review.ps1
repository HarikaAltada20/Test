$ErrorActionPreference = "Stop"

# Ensure we run from the repo root (so relative paths like `reviews/...` work reliably)
Set-Location (Split-Path -Parent $PSScriptRoot)

$branch = git branch --show-current
if ([string]::IsNullOrWhiteSpace($branch)) {
    throw "Could not determine current branch name (are you in a detached HEAD state?)."
}

Write-Host "Current branch: $branch"

# Branch names can contain `/` (e.g. `feature/foo`), which is not valid for a filename.
# Also keep the resulting diff path flat so we don't need to create nested folders.
$safeBranch = $branch -replace '[\\/:"*?<>|]', '-'

$diffFile = Join-Path "reviews" ("pr-$safeBranch.diff")
$diffDir = Split-Path -Parent $diffFile
if (-not (Test-Path $diffDir)) {
    New-Item -ItemType Directory -Path $diffDir -Force | Out-Null
}

# Write diff directly to the file path to avoid redirection quirks and allow encoding control.
git diff "main...$branch" | Out-File -FilePath $diffFile -Encoding utf8

Write-Host "Diff created at $diffFile"
# code $diffFile