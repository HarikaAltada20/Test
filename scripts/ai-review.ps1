$branch = git branch --show-current

Write-Host "Current branch: $branch"

$diffFile = "reviews/pr-$branch.diff"

git diff main...$branch > $diffFile

Write-Host "Diff created at $diffFile"

code $diffFile