<#
.SYNOPSIS
    Copies the actual Storage files (images, documents...) from MAIN to TEST.

.DESCRIPTION
    clone-db.ps1 copies the database, which includes the LIST of files
    (storage.objects), but not the files themselves. This script copies the
    files through Supabase's Storage API. Run it after clone-db.ps1.

    MAIN is only ever read: the script only downloads from MAIN.
    Safe to run again: files that TEST can already serve are skipped, so an
    interrupted run simply continues where it stopped.

    Steps:
      1. Read clone-db.config.json (the two database addresses + two secret keys).
      2. Safety checks: two different projects, and each key belongs to its project.
      3. Read the list of files from MAIN's database (read-only) and TEST's buckets.
      4. Show the plan and wait for you to type YES.
      5. For each file: skip it if TEST already has it, otherwise download it
         from MAIN and upload it to the same bucket and path on TEST.
      6. Put back each file's owner, dates and details on TEST (the upload resets them).

.PARAMETER CheckOnly
    Do steps 1-4 only and change nothing.

.PARAMETER All
    Copy every file again, even the ones TEST already has.

.PARAMETER Limit
    Only handle the first N files (for a quick trial run), e.g. -Limit 10.

.PARAMETER Bucket
    Only handle the files of this one bucket, e.g. -Bucket contest-assets.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\copy-storage.ps1 -CheckOnly
    powershell -ExecutionPolicy Bypass -File .\copy-storage.ps1
#>
[CmdletBinding()]
param(
    [switch]$CheckOnly,
    [switch]$All,
    [int]$Limit = 0,
    [string]$Bucket = '',
    [string]$ConfigFile = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

$ScriptDir = $PSScriptRoot
if (-not $ConfigFile) { $ConfigFile = Join-Path $ScriptDir 'clone-db.config.json' }
$Utf8 = New-Object System.Text.UTF8Encoding($false)

# ---------------------------------------------------------------- helpers ---

function Write-Step([string]$Number, [string]$Text) {
    Write-Host ''
    Write-Host "=== Step $Number. $Text" -ForegroundColor Cyan
}
function Write-Ok([string]$Text)   { Write-Host "  OK    $Text" -ForegroundColor Green }
function Write-Info([string]$Text) { Write-Host "        $Text" }
function Write-Warn([string]$Text) { Write-Host "  WARN  $Text" -ForegroundColor Yellow }
function Stop-Copy([string]$Text) {
    Write-Host ''
    Write-Host "STOPPED: $Text" -ForegroundColor Red
    throw 'copy-storage stopped'
}
function Write-TextFile([string]$Path, [string[]]$Lines) {
    $w = New-Object System.IO.StreamWriter($Path, $false, $Utf8)
    $w.NewLine = "`n"
    try { foreach ($l in $Lines) { $w.WriteLine($l) } } finally { $w.Close() }
}
function Read-TextFile([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return @() }
    return [System.IO.File]::ReadAllLines($Path, $Utf8)
}
function Format-Size([double]$Bytes) {
    if ($Bytes -ge 1GB) { return '{0:N2} GB' -f ($Bytes / 1GB) }
    if ($Bytes -ge 1MB) { return '{0:N1} MB' -f ($Bytes / 1MB) }
    return '{0:N0} KB' -f ($Bytes / 1KB)
}

# The project ref is in the Session pooler user name: postgres.<ref>
function Get-ProjectRef([string]$Url) {
    if ($Url -match '^postgres(?:ql)?://postgres\.(?<r>[A-Za-z0-9]+)[:@]') { return $Matches['r'].ToLowerInvariant() }
    if ($Url -match '@db\.(?<r>[a-z0-9]+)\.supabase\.co') { return $Matches['r'] }
    return ''
}

function Get-ConfigValue($Config, [string]$Name) {
    if ($Config.PSObject.Properties.Name -contains $Name) { return ([string]$Config.$Name).Trim() }
    return ''
}

# Run SQL with psql. -ReadOnly makes the session read-only, so it cannot change anything.
function Invoke-Psql([string]$Url, [string]$File, [string]$OutFile, [string]$What, [switch]$ReadOnly) {
    $a = @('-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-d', $Url, '-o', $OutFile)
    if ($ReadOnly) { $a += @('-c', 'SET default_transaction_read_only = on') }
    $a += @('-f', $File)
    $old = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & $Psql @a } finally { $ErrorActionPreference = $old }
    if ($LASTEXITCODE -ne 0) { Stop-Copy "$What failed (exit code $LASTEXITCODE). See the messages above." }
    return @(Read-TextFile $OutFile)
}

# What kind of key is this? Legacy keys are JWTs that name their project and role.
function Test-SecretKey([string]$Name, [string]$Key, [string]$Ref) {
    if (-not $Key -or $Key -match 'YOUR-') { Stop-Copy "${Name}ServiceKey in the config file is empty. Copy the secret key from Supabase: Project Settings > API Keys." }
    if ($Key.StartsWith('sb_publishable_')) { Stop-Copy "${Name}ServiceKey is a publishable key. Use the SECRET key (sb_secret_...) or the legacy service_role key." }
    if ($Key.StartsWith('sb_secret_')) { return }
    $parts = $Key.Split('.')
    if ($parts.Length -ne 3) { Stop-Copy "${Name}ServiceKey does not look like a Supabase key." }
    $p = $parts[1].Replace('-', '+').Replace('_', '/')
    while ($p.Length % 4) { $p += '=' }
    try { $claims = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($p)) | ConvertFrom-Json }
    catch { Stop-Copy "${Name}ServiceKey does not look like a Supabase key." }
    $role = if ($claims.PSObject.Properties.Name -contains 'role') { [string]$claims.role } else { '' }
    $kref = if ($claims.PSObject.Properties.Name -contains 'ref')  { [string]$claims.ref }  else { '' }
    if ($role -ne 'service_role') { Stop-Copy "${Name}ServiceKey is the '$role' key. Use the service_role key (or the sb_secret_ key)." }
    if ($Ref -and $kref -and $kref -ne $Ref) { Stop-Copy "${Name}ServiceKey belongs to project $kref, but the ${Name} database is project $Ref." }
}

# ------------------------------------------------------------- HTTP calls ---

Add-Type -AssemblyName System.Net.Http
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
$Http = New-Object System.Net.Http.HttpClient
$Http.Timeout = [TimeSpan]::FromMinutes(30)

function New-Request([string]$Method, [string]$Url, [string]$Key) {
    $r = New-Object System.Net.Http.HttpRequestMessage((New-Object System.Net.Http.HttpMethod($Method)), $Url)
    [void]$r.Headers.TryAddWithoutValidation('apikey', $Key)
    if (-not $Key.StartsWith('sb_')) { [void]$r.Headers.TryAddWithoutValidation('Authorization', "Bearer $Key") }
    return $r
}
function Send-Request($Request) {
    return $Http.SendAsync($Request, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
}
function Get-ErrorText($Response) {
    $t = ''
    try { $t = $Response.Content.ReadAsStringAsync().GetAwaiter().GetResult() } catch { }
    if ($t.Length -gt 300) { $t = $t.Substring(0, 300) }
    return "HTTP $([int]$Response.StatusCode) $t"
}
# bucket/path -> URL piece, each part encoded (spaces, # and ? in file names)
function Get-ObjectPath([string]$Bucket, [string]$Name) {
    $segs = @([Uri]::EscapeDataString($Bucket))
    foreach ($s in $Name.Split('/')) { $segs += [Uri]::EscapeDataString($s) }
    return ($segs -join '/')
}

# Does TEST really have the file? Reads 1 byte of it (the list alone can exist without the file).
function Test-TestHasFile([string]$Bucket, [string]$Name) {
    $req = New-Request 'GET' "$TestApi/object/authenticated/$(Get-ObjectPath $Bucket $Name)" $TestKey
    $req.Headers.Range = New-Object System.Net.Http.Headers.RangeHeaderValue([long]0, [long]0)
    $resp = Send-Request $req
    try { return @(200, 206, 416) -contains [int]$resp.StatusCode } finally { $resp.Dispose() }
}

# Download one file from MAIN into $Path. Only GET is ever sent to MAIN.
function Get-MainFile([string]$Bucket, [string]$Name, [string]$Path) {
    $resp = Send-Request (New-Request 'GET' "$MainApi/object/authenticated/$(Get-ObjectPath $Bucket $Name)" $MainKey)
    try {
        if ([int]$resp.StatusCode -eq 400 -or [int]$resp.StatusCode -eq 404) { return 'missing' }
        if (-not $resp.IsSuccessStatusCode) { throw "download from MAIN: $(Get-ErrorText $resp)" }
        $fs = [System.IO.File]::Create($Path)
        try { $resp.Content.CopyToAsync($fs).GetAwaiter().GetResult() } finally { $fs.Close() }
        return 'ok'
    } finally { $resp.Dispose() }
}

# Upload one file to TEST (x-upsert replaces the entry clone-db.ps1 already created).
function Send-TestFile([string]$Bucket, [string]$Name, [string]$Path, [string]$Mime, [string]$CacheControl) {
    $req = New-Request 'POST' "$TestApi/object/$(Get-ObjectPath $Bucket $Name)" $TestKey
    [void]$req.Headers.TryAddWithoutValidation('x-upsert', 'true')
    if ($CacheControl) { [void]$req.Headers.TryAddWithoutValidation('cache-control', $CacheControl) }
    $fs = [System.IO.File]::OpenRead($Path)
    try {
        $content = New-Object System.Net.Http.StreamContent($fs)
        if (-not $Mime) { $Mime = 'application/octet-stream' }
        if (-not $content.Headers.TryAddWithoutValidation('Content-Type', $Mime)) {
            [void]$content.Headers.TryAddWithoutValidation('Content-Type', 'application/octet-stream')
        }
        $req.Content = $content
        $resp = Send-Request $req
        try { if (-not $resp.IsSuccessStatusCode) { throw "upload to TEST: $(Get-ErrorText $resp)" } } finally { $resp.Dispose() }
    } finally { $fs.Close() }
}

# Retry network hiccups a few times before giving up on a file.
function Invoke-WithRetry([scriptblock]$Action) {
    for ($try = 1; ; $try++) {
        try { return (& $Action) }
        catch {
            if ($try -ge 3 -or "$_" -match 'HTTP 4\d\d') { throw }
            Start-Sleep -Seconds (2 * $try)
        }
    }
}

# ------------------------------------------------------------------ main ----

$script:exitCode = 1
$script:transcript = $false

function Invoke-Main {
    Write-Step '1' 'Read the config file'
    if (-not (Test-Path -LiteralPath $ConfigFile)) { Stop-Copy "Config file not found: $ConfigFile" }
    $config  = Get-Content -LiteralPath $ConfigFile -Raw -Encoding UTF8 | ConvertFrom-Json
    $mainUrl = Get-ConfigValue $config 'MainDbUrl'
    $testUrl = Get-ConfigValue $config 'TestDbUrl'
    $MainKey = Get-ConfigValue $config 'MainServiceKey'
    $TestKey = Get-ConfigValue $config 'TestServiceKey'
    $binDir  = Get-ConfigValue $config 'PgBinDir'
    if (-not $mainUrl -or -not $testUrl) { Stop-Copy 'MainDbUrl or TestDbUrl is missing in the config file.' }

    $Psql = 'psql'
    if ($binDir) {
        $Psql = Join-Path $binDir 'psql.exe'
        if (-not (Test-Path -LiteralPath $Psql)) { $Psql = Join-Path $binDir 'psql' }
        if (-not (Test-Path -LiteralPath $Psql)) { Stop-Copy "Could not find psql in PgBinDir '$binDir'." }
    }
    $env:PGCLIENTENCODING  = 'UTF8'
    $env:PGAPPNAME         = 'copy-storage'
    $env:PGCONNECT_TIMEOUT = '20'

    $mainRef = Get-ProjectRef $mainUrl
    $testRef = Get-ProjectRef $testUrl
    # The project address normally comes from the ref; MainProjectUrl/TestProjectUrl can override it.
    $mainProject = Get-ConfigValue $config 'MainProjectUrl'
    $testProject = Get-ConfigValue $config 'TestProjectUrl'
    if (-not $mainProject) { if (-not $mainRef) { Stop-Copy 'Could not find the MAIN project ref in MainDbUrl.' }; $mainProject = "https://$mainRef.supabase.co" }
    if (-not $testProject) { if (-not $testRef) { Stop-Copy 'Could not find the TEST project ref in TestDbUrl.' }; $testProject = "https://$testRef.supabase.co" }
    $MainApi = $mainProject.TrimEnd('/') + '/storage/v1'
    $TestApi = $testProject.TrimEnd('/') + '/storage/v1'
    Write-Ok 'Config read.'

    Write-Step '2' 'Safety checks: two different projects, and the right key for each'
    Write-Info "MAIN = $mainProject   (files are only downloaded from here)"
    Write-Info "TEST = $testProject   <- files are uploaded here"
    if ($mainProject -eq $testProject -or $mainUrl -eq $testUrl -or ($mainRef -and $mainRef -eq $testRef)) {
        Stop-Copy 'MAIN and TEST point to the same project.'
    }
    if ($MainKey -eq $TestKey) { Stop-Copy 'MainServiceKey and TestServiceKey are the same key.' }
    Test-SecretKey 'Main' $MainKey $mainRef
    Test-SecretKey 'Test' $TestKey $testRef
    foreach ($side in @(@('MAIN', $MainApi, $MainKey), @('TEST', $TestApi, $TestKey))) {
        $resp = Send-Request (New-Request 'GET' "$($side[1])/bucket" $side[2])
        try {
            if (-not $resp.IsSuccessStatusCode) { Stop-Copy "$($side[0]) did not accept its key ($(Get-ErrorText $resp)). Check the key in the config file." }
        } finally { $resp.Dispose() }
    }
    Write-Ok 'Each key works on its own project.'

    $runDir = Join-Path $ScriptDir (Join-Path 'runs' ((Get-Date -Format 'yyyy-MM-dd_HHmmss') + '_storage'))
    New-Item -ItemType Directory -Path $runDir -Force | Out-Null
    try { Start-Transcript -Path (Join-Path $runDir 'log.txt') | Out-Null; $script:transcript = $true } catch { }

    Write-Step '3' 'Read the list of files from MAIN (read-only) and the buckets on TEST'
    $listSql = Join-Path $runDir 'list-files.sql'
    Write-TextFile $listSql @(
        "SELECT json_build_object('b', o.bucket_id, 'n', o.name,",
        "  'm', coalesce(o.metadata->>'mimetype', ''), 'c', coalesce(o.metadata->>'cacheControl', ''),",
        "  's', CASE WHEN o.metadata->>'size' ~ '^[0-9]+$' THEN (o.metadata->>'size')::bigint ELSE 0 END,",
        "  'o', o.owner, 'oi', to_jsonb(o)->>'owner_id', 'ca', o.created_at, 'ua', o.updated_at, 'md', o.metadata)",
        "FROM storage.objects o WHERE o.name IS NOT NULL AND o.bucket_id IS NOT NULL ORDER BY o.bucket_id, o.name;")
    # keep each original line too, so owners and dates go back to TEST exactly as MAIN wrote them
    $files = @(Invoke-Psql $mainUrl $listSql (Join-Path $runDir 'main-files.txt') 'Reading the file list from MAIN' -ReadOnly |
               Where-Object { $_ } | ForEach-Object { $o = $_ | ConvertFrom-Json; $o | Add-Member Raw $_; $o })
    $bucketSql = Join-Path $runDir 'list-buckets.sql'
    Write-TextFile $bucketSql @('SELECT id FROM storage.buckets ORDER BY id;')
    $testBuckets = @(Invoke-Psql $testUrl $bucketSql (Join-Path $runDir 'test-buckets.txt') 'Reading the buckets on TEST' -ReadOnly | Where-Object { $_ })

    # optional trial-run filters: one bucket and/or the first N files
    $allCount = $files.Count
    if ($Bucket) {
        $files = @($files | Where-Object { $_.b -eq $Bucket })
        if ($files.Count -eq 0) { Stop-Copy "MAIN has no files in a bucket called '$Bucket'." }
    }
    if ($Limit -gt 0) { $files = @($files | Select-Object -First $Limit) }

    $byBucket = [ordered]@{}
    $total = 0.0
    foreach ($f in $files) {
        if (-not $byBucket.Contains($f.b)) { $byBucket[$f.b] = @(0, 0.0) }
        $byBucket[$f.b][0] += 1; $byBucket[$f.b][1] += [double]$f.s; $total += [double]$f.s
    }
    $missingBuckets = @($byBucket.Keys | Where-Object { $testBuckets -notcontains $_ })
    if ($missingBuckets.Count -gt 0) {
        Stop-Copy "These buckets exist on MAIN but not on TEST: $($missingBuckets -join ', '). Run clone-db.ps1 first."
    }
    Write-Ok "$($files.Count) files selected, $(Format-Size $total) in total."

    Write-Step '4' 'The plan'
    foreach ($b in $byBucket.Keys) { Write-Info ("{0,-30} {1,7} files  {2,10}" -f $b, $byBucket[$b][0], (Format-Size $byBucket[$b][1])) }
    Write-Info ''
    if ($files.Count -lt $allCount) { Write-Info "Trial run: only these $($files.Count) of the $allCount files are handled." }
    if ($All) { Write-Info 'Every file is copied again (-All).' }
    else      { Write-Info 'Files TEST already has are skipped; the rest are copied.' }
    Write-Info 'Nothing is deleted anywhere, and nothing on MAIN is changed.'
    if ($files.Count -eq 0) { Write-Ok 'MAIN has no files, nothing to do.'; $script:exitCode = 0; return }
    if ($CheckOnly) { Write-Host ''; Write-Ok 'Check-only run finished. Nothing was changed.'; $script:exitCode = 0; return }
    Write-Host ''
    $answer = Read-Host 'Type YES to copy the files to TEST'
    if ($answer -cne 'YES') { Stop-Copy 'You did not type YES.' }

    Write-Step '5' 'Copy the files (an interrupted run can simply be started again)'
    $tmp = Join-Path $runDir 'one-file.tmp'
    $copied = New-Object System.Collections.Generic.List[string]
    $failed = New-Object System.Collections.Generic.List[string]
    $notOnMain = New-Object System.Collections.Generic.List[string]
    $skipped = 0; $i = 0; $doneBytes = 0.0
    $started = Get-Date
    foreach ($f in $files) {
        $i++
        $label = "$($f.b)/$($f.n)"
        try {
            if (-not $All -and (Invoke-WithRetry { Test-TestHasFile $f.b $f.n })) { $skipped++ }
            else {
                $got = Invoke-WithRetry { Get-MainFile $f.b $f.n $tmp }
                if ($got -eq 'missing') { $notOnMain.Add($label) }
                else {
                    Invoke-WithRetry { Send-TestFile $f.b $f.n $tmp $f.m $f.c }
                    $copied.Add($f.Raw)
                    $doneBytes += [double]$f.s
                }
            }
        } catch {
            $failed.Add("$label`t$_")
            Write-Warn "$label : $_"
        }
        if ($i % 25 -eq 0 -or $i -eq $files.Count) {
            $secs = [int]((Get-Date) - $started).TotalSeconds
            Write-Info ("{0}/{1} checked  copied {2} ({3})  already there {4}  failed {5}  [{6} s]" -f $i, $files.Count, $copied.Count, (Format-Size $doneBytes), $skipped, $failed.Count, $secs)
        }
    }
    if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force }

    Write-Step '6' 'Put back the owner, dates and details of the copied files on TEST'
    if ($copied.Count -gt 0) {
        $copiedFile = Join-Path $runDir 'copied-files.txt'
        Write-TextFile $copiedFile @($copied)
        $fixSql = Join-Path $runDir 'fix-owners.sql'
        # psql reads backslashes in file names as escapes, and Windows accepts forward slashes
        $path = $copiedFile.Replace('\', '/').Replace("'", "''")
        Write-TextFile $fixSql @(
            'BEGIN;',
            'SET LOCAL session_replication_role = replica;  -- keep the dates exactly as on MAIN',
            'CREATE TEMP TABLE copied (line text) ON COMMIT DROP;',
            "\copy copied FROM '$path' WITH (FORMAT csv, QUOTE E'\x01', DELIMITER E'\x02')",
            'UPDATE storage.objects o',
            "   SET owner = (j->>'o')::uuid, owner_id = j->>'oi',",
            "       created_at = (j->>'ca')::timestamptz, updated_at = (j->>'ua')::timestamptz, metadata = j->'md'",
            '  FROM (SELECT line::jsonb AS j FROM copied) x',
            " WHERE o.bucket_id = x.j->>'b' AND o.name = x.j->>'n';",
            'COMMIT;')
        [void](Invoke-Psql $testUrl $fixSql (Join-Path $runDir 'fix-owners-output.txt') 'Restoring owners on TEST')
        Write-Ok "Owner, dates and details restored for $($copied.Count) files."
    } else { Write-Ok 'No files were copied, nothing to do.' }

    Write-Host ''
    Write-Host '=== Result' -ForegroundColor Cyan
    Write-Info "Copied now:              $($copied.Count) files ($(Format-Size $doneBytes))"
    Write-Info "Already on TEST:         $skipped files"
    if ($notOnMain.Count -gt 0) {
        Write-TextFile (Join-Path $runDir 'missing-on-main.txt') @($notOnMain)
        Write-Warn "Listed but missing on MAIN too: $($notOnMain.Count) files (broken uploads; see missing-on-main.txt)"
    }
    if ($failed.Count -gt 0) {
        Write-TextFile (Join-Path $runDir 'failed.txt') @($failed)
        Write-Host "  FAILED: $($failed.Count) files, listed in $(Join-Path $runDir 'failed.txt'). Run the script again to retry them." -ForegroundColor Red
        $script:exitCode = 2
    } else {
        if ($files.Count -lt $allCount) { Write-Host "  All $($files.Count) trial files are on TEST. Run without -Limit/-Bucket to copy the rest." -ForegroundColor Green }
        else { Write-Host '  All files are on TEST.' -ForegroundColor Green }
        $script:exitCode = 0
    }
}

try { Invoke-Main | Out-Null }
catch {
    if ("$_" -ne 'copy-storage stopped') { Write-Host "ERROR: $_" -ForegroundColor Red }
    $script:exitCode = 1
}
finally {
    if ($script:transcript) { try { Stop-Transcript | Out-Null } catch { } }
    $Http.Dispose()
}
exit $script:exitCode
