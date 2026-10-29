<#
.SYNOPSIS
    Makes the TEST Supabase database an exact working copy of the MAIN one.

.DESCRIPTION
    Safe to run again whenever you want to refresh TEST from MAIN.
    MAIN is only ever read. TEST is replaced in ONE transaction: if anything
    goes wrong, TEST stays exactly as it was before the run.

    Steps (each one prints what it is doing):
      1. Read the two addresses from clone-db.config.json and find pg_dump/psql.
      2. Safety checks: MAIN and TEST must be different databases.
      3. Look at both databases (read-only) and check everything needed is there.
      4. Show you the plan and wait for you to type YES.
      5. Export from MAIN (read-only): your schemas' structure + data,
         auth users/identities, storage buckets/objects records.
      6. Prepare the files (remove the few lines Supabase does not allow).
      7. Import into TEST in one transaction: reset TEST, then structure, then data.
      8. Compare MAIN and TEST: row counts, checksums, structure, permissions.

.PARAMETER CheckOnly
    Do steps 1-4 only (look, check, show the plan) and change nothing.

.PARAMETER VerifyOnly
    Only compare MAIN and TEST (steps 1-3 and 8) and change nothing.
    Handy to check later whether TEST has drifted away from MAIN.

.PARAMETER KeepFiles
    Keep the exported data files after a successful run (they contain your
    users' emails and password hashes, so by default they are deleted).

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\clone-db.ps1 -CheckOnly
    powershell -ExecutionPolicy Bypass -File .\clone-db.ps1
    powershell -ExecutionPolicy Bypass -File .\clone-db.ps1 -VerifyOnly
#>
[CmdletBinding()]
param(
    [switch]$CheckOnly,
    [switch]$VerifyOnly,
    [switch]$KeepFiles,
    [string]$ConfigFile = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

$ScriptDir = $PSScriptRoot
if (-not $ConfigFile) { $ConfigFile = Join-Path $ScriptDir 'clone-db.config.json' }
$SqlDir    = Join-Path $ScriptDir 'sql'
$Utf8      = New-Object System.Text.UTF8Encoding($false)   # UTF-8 without BOM, for every file we write

# ---------------------------------------------------------------- helpers ---

function Write-Step([string]$Number, [string]$Text) {
    Write-Host ''
    Write-Host "=== Step $Number. $Text" -ForegroundColor Cyan
}
function Write-Ok([string]$Text)   { Write-Host "  OK    $Text" -ForegroundColor Green }
function Write-Info([string]$Text) { Write-Host "        $Text" }
function Write-Warn([string]$Text) { Write-Host "  WARN  $Text" -ForegroundColor Yellow }

# Stop the run with a clear message. $TestUntouched says whether TEST is guaranteed unchanged.
function Stop-Clone([string]$Text, [bool]$TestUntouched = $true) {
    Write-Host ''
    Write-Host "STOPPED: $Text" -ForegroundColor Red
    if ($TestUntouched) { Write-Host 'Nothing was changed on TEST (or MAIN).' -ForegroundColor Red }
    throw 'clone-db stopped'
}

function Quote-Ident([string]$Name)   { return '"' + $Name.Replace('"', '""') + '"' }
function Quote-Literal([string]$Text) { return "'" + $Text.Replace("'", "''") + "'" }
function ConvertTo-JsonList([string[]]$Items) {
    $parts = @()
    foreach ($i in $Items) { $parts += '"' + $i.Replace('\', '\\').Replace('"', '\"') + '"' }
    return '[' + ($parts -join ',') + ']'
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

# Run a Postgres program. Its messages go straight to the screen; we only check the exit code.
function Invoke-PgTool([string]$Exe, [string[]]$Arguments, [string]$What) {
    $old = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & $Exe @Arguments } finally { $ErrorActionPreference = $old }
    if ($LASTEXITCODE -ne 0) { throw "$What failed (exit code $LASTEXITCODE). See the messages above." }
}

# Run SQL files with psql against one database and return the printed lines.
# -ReadOnly makes the whole session read-only, so it cannot change anything.
function Invoke-Query([string]$Url, [string[]]$Files, [string]$OutFile, [string]$What, [switch]$ReadOnly) {
    $a = @('-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-d', $Url, '-o', $OutFile)
    if ($ReadOnly) { $a += @('-c', 'SET default_transaction_read_only = on') }
    foreach ($f in $Files) { $a += @('-f', $f) }
    Invoke-PgTool $Psql $a $What
    return @(Read-TextFile $OutFile)
}

# Split "kind<TAB>a<TAB>b" lines into objects.
function ConvertFrom-Facts([string[]]$Lines) {
    $result = @()
    foreach ($l in $Lines) {
        if (-not $l) { continue }
        $p = $l.Split("`t")
        $result += [pscustomobject]@{ Kind = $p[0]; A = $(if ($p.Length -gt 1) { $p[1] } else { '' });
                                      B = $(if ($p.Length -gt 2) { $p[2] } else { '' }); Line = $l }
    }
    return $result
}
function Get-Fact($Facts, [string]$Kind, [string]$A) {
    foreach ($f in $Facts) { if ($f.Kind -eq $Kind -and $f.A -eq $A) { return $f.B } }
    return $null
}
function Get-Facts($Facts, [string]$Kind) {
    return @($Facts | Where-Object { $_.Kind -eq $Kind })
}

# Pull the parts out of a postgresql:// address.
function Get-DbAddress([string]$Name, [string]$Url) {
    $m = [regex]::Match($Url, '^postgres(?:ql)?://(?<user>[^:@/]+)(?::(?<pw>[^@/]*))?@(?<host>[^:/?@]+)(?::(?<port>\d+))?/(?<db>[^?/]+)')
    if (-not $m.Success) {
        Stop-Clone "$Name address is not a valid postgresql:// address. Copy it again from Supabase: Project Settings > Database > Connection string > Session pooler. If your password contains @ : / ? # or %, it must be URL-encoded (e.g. @ becomes %40)."
    }
    if ($Url.Split('@').Length -gt 2) {
        Stop-Clone "$Name address contains more than one '@'. Your password probably contains '@': write it as %40 instead."
    }
    $hostName = $m.Groups['host'].Value.ToLowerInvariant()
    $user     = $m.Groups['user'].Value
    $port     = if ($m.Groups['port'].Success) { $m.Groups['port'].Value } else { '5432' }
    $ref      = ''
    if ($user -match '^postgres\.(?<r>[A-Za-z0-9]+)$') { $ref = $Matches['r'].ToLowerInvariant() }
    elseif ($hostName -match '^db\.(?<r>[a-z0-9]+)\.supabase\.co$') { $ref = $Matches['r'] }
    return [pscustomobject]@{
        Name = $Name; User = $user; Host = $hostName; Port = $port; Db = $m.Groups['db'].Value; Ref = $ref
        Display = "$user@${hostName}:$port/$($m.Groups['db'].Value)"
    }
}

# Find pg_dump / pg_restore / psql: config PgBinDir, then PATH, then the usual Windows install folder.
function Find-PgTool([string]$Name, [string]$BinDir) {
    if ($BinDir) {
        foreach ($n in @("$Name.exe", $Name)) {
            $p = Join-Path $BinDir $n
            if (Test-Path -LiteralPath $p) { return $p }
        }
        Stop-Clone "Could not find $Name in PgBinDir '$BinDir' (from the config file)."
    }
    $cmd = Get-Command $Name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($cmd) { return $cmd.Path }
    $installed = Get-ChildItem -Path 'C:\Program Files\PostgreSQL\*\bin' -Directory -ErrorAction SilentlyContinue |
                 Sort-Object { [int]($_.Parent.Name -replace '\D.*$', '') } -Descending
    foreach ($dir in $installed) {
        $p = Join-Path $dir.FullName "$Name.exe"
        if (Test-Path -LiteralPath $p) { return $p }
    }
    Stop-Clone "Could not find $Name. Put the Postgres 'bin' folder in PgBinDir in the config file, e.g. C:\Program Files\PostgreSQL\17\bin"
}
function Get-ToolMajor([string]$Exe) {
    $v = (& $Exe --version) | Select-Object -First 1
    $m = [regex]::Match([string]$v, '(\d+)\.\d+')
    if (-not $m.Success) { Stop-Clone "Could not read the version of $Exe ('$v')." }
    return [int]$m.Groups[1].Value
}

# Copy a pg_dump structure file, leaving out the lines Supabase does not allow
# (each removed line + the reason goes into removed-lines.txt so you can read it).
function Convert-StructureFile([string]$In, [string]$Out, [string]$LogPath, [string]$CurrentUser) {
    $moved = New-Object System.Collections.Generic.List[string]
    $reader = New-Object System.IO.StreamReader($In, $Utf8)
    $writer = New-Object System.IO.StreamWriter($Out, $false, $Utf8); $writer.NewLine = "`n"
    $log    = New-Object System.IO.StreamWriter($LogPath, $true, $Utf8);  $log.NewLine = "`n"
    $removed = 0; $n = 0
    try {
        $log.WriteLine("Lines removed or changed in the STRUCTURE file ($([System.IO.Path]::GetFileName($Out))):")
        while ($null -ne ($line = $reader.ReadLine())) {
            $n++
            $reason = $null
            if ($line -ceq 'SET transaction_timeout = 0;') {
                $reason = 'pg_dump 17 adds this setting; Postgres 15 servers do not know it and would stop'
            } elseif ($line -ceq 'CREATE SCHEMA public;') {
                $reason = 'public already exists on TEST and is kept (with its Supabase permissions)'
            } elseif ($line -ceq "COMMENT ON SCHEMA public IS 'standard public schema';") {
                $reason = 'the default comment; TEST already has it'
            } elseif ($line -clike 'COMMENT ON SCHEMA public IS *;') {
                # a custom comment (e.g. pg_graphql settings): try it, but only warn if Supabase does not allow it
                $new = 'DO $clone$ BEGIN EXECUTE ' + (Quote-Literal $line.TrimEnd(';')) +
                       '; EXCEPTION WHEN insufficient_privilege THEN RAISE WARNING ''Could not copy the comment on schema public: %'', SQLERRM; END $clone$;'
                $log.WriteLine("  line ${n}: $line")
                $log.WriteLine('     -> wrapped so that, if Supabase refuses it, you get a warning instead of a failed run')
                $line = $new
            } elseif ($line -cmatch '^(GRANT|REVOKE) .* ON SCHEMA public (TO|FROM) ') {
                $reason = "public's own permissions on TEST are left exactly as Supabase set them"
            } elseif ($line -cmatch '^ALTER DEFAULT PRIVILEGES FOR ROLE ("?)([^" ]+)\1 ' -and $Matches[2] -cne $CurrentUser) {
                $reason = "a Supabase-internal auto-grant rule for role $($Matches[2]); postgres may not change it and TEST already has its own"
            } elseif ($line -cmatch '^(SET|RESET) SESSION AUTHORIZATION') {
                $reason = 'needs superuser; the GRANT next to it still runs (as postgres), so the permission itself is copied'
            } elseif ($line -clike 'REFRESH MATERIALIZED VIEW *') {
                $moved.Add($line)
                $reason = 'moved to the end, after the data is loaded (otherwise it would be filled from empty tables)'
            } elseif ($line -cmatch '^CREATE SCHEMA (.+);$') {
                $new = "CREATE SCHEMA IF NOT EXISTS $($Matches[1]);"
                $log.WriteLine("  line ${n}: $line")
                $log.WriteLine("     -> $new   (harmless; needed if an extension already created this schema)")
                $line = $new
            }
            if ($reason) {
                $removed++
                $log.WriteLine("  line ${n}: $line")
                $log.WriteLine("     reason: $reason")
                continue
            }
            $writer.WriteLine($line)
        }
        $log.WriteLine('')
    } finally { $reader.Close(); $writer.Close(); $log.Close() }
    return [pscustomobject]@{ Removed = $removed; Refresh = $moved }
}

# Copy a pg_dump data file, dropping the one header line Postgres 15 rejects,
# and count the rows of every table in it (used to double-check the import).
function Convert-DataFile([string]$In, [string]$Out, $Counts) {
    $reader = New-Object System.IO.StreamReader($In, $Utf8)
    $writer = New-Object System.IO.StreamWriter($Out, $false, $Utf8); $writer.NewLine = "`n"
    $table = $null; $rows = 0; $inHeader = $true
    try {
        while ($null -ne ($line = $reader.ReadLine())) {
            if ($null -ne $table) {
                if ($line -ceq '\.') { $Counts[$table] = $rows; $table = $null }
                else { $rows++ }
            } elseif ($line.StartsWith('COPY ')) {
                $inHeader = $false
                $m = [regex]::Match($line, '^COPY (.+?) (\(.*\) )?FROM stdin;$')
                if (-not $m.Success) { throw "Unexpected COPY line in ${In}: $line" }
                $table = $m.Groups[1].Value; $rows = 0
            } elseif ($inHeader -and $line -ceq 'SET transaction_timeout = 0;') {
                continue
            }
            $writer.WriteLine($line)
        }
    } finally { $reader.Close(); $writer.Close() }
}

# -------------------------------------------------------------------- main ---

$savedEnv = @{}
foreach ($v in @('PGCLIENTENCODING', 'PGAPPNAME', 'PGCONNECT_TIMEOUT')) { $savedEnv[$v] = [Environment]::GetEnvironmentVariable($v) }
$transcript = $false
$exitCode = 1

try {
    # --------------------------------------------------------------- step 1
    Write-Step '1' 'Read the config file and find the Postgres tools'
    if (-not (Test-Path -LiteralPath $ConfigFile)) {
        Stop-Clone "Config file not found: $ConfigFile`n         Copy clone-db.config.example.json to clone-db.config.json and paste your two Session pooler addresses into it."
    }
    $config = Get-Content -LiteralPath $ConfigFile -Raw -Encoding UTF8 | ConvertFrom-Json
    $mainUrl = ([string]$config.MainDbUrl).Trim()
    $testUrl = ([string]$config.TestDbUrl).Trim()
    $binDir  = ''
    if ($config.PSObject.Properties.Name -contains 'PgBinDir') { $binDir = ([string]$config.PgBinDir).Trim() }
    if (-not $mainUrl -or $mainUrl -match 'YOUR-|PASSWORD]') { Stop-Clone 'MainDbUrl in the config file is empty or still the example text.' }
    if (-not $testUrl -or $testUrl -match 'YOUR-|PASSWORD]') { Stop-Clone 'TestDbUrl in the config file is empty or still the example text.' }

    $PgDump    = Find-PgTool 'pg_dump'    $binDir
    $PgRestore = Find-PgTool 'pg_restore' $binDir
    $Psql      = Find-PgTool 'psql'       $binDir
    $toolMajor = Get-ToolMajor $PgDump
    if ($toolMajor -lt 17) { Stop-Clone "pg_dump is version $toolMajor; version 17 or newer is needed (it is what Supabase uses and it has the --filter option this script relies on)." }
    Write-Ok "pg_dump, pg_restore and psql version $toolMajor found ($([System.IO.Path]::GetDirectoryName($PgDump)))"

    $env:PGCLIENTENCODING  = 'UTF8'      # read and write everything as UTF-8 (names, emojis, Hindi text...)
    $env:PGAPPNAME         = 'clone-db'
    $env:PGCONNECT_TIMEOUT = '20'

    # --------------------------------------------------------------- step 2
    Write-Step '2' 'Safety checks: MAIN and TEST must be two different databases'
    $main = Get-DbAddress 'MAIN' $mainUrl
    $test = Get-DbAddress 'TEST' $testUrl
    Write-Info "MAIN = $($main.Display)"
    Write-Info "TEST = $($test.Display)   <- the one that will be replaced"
    if ($mainUrl -eq $testUrl) { Stop-Clone 'MainDbUrl and TestDbUrl are identical.' }
    if ($main.Ref -and $main.Ref -eq $test.Ref) { Stop-Clone "MAIN and TEST point to the same Supabase project ($($main.Ref))." }
    if ($main.User -eq $test.User -and $main.Host -eq $test.Host -and $main.Port -eq $test.Port -and $main.Db -eq $test.Db) {
        Stop-Clone 'MAIN and TEST have the same user, host, port and database: they are the same database.'
    }
    foreach ($a in @($main, $test)) {
        if ($a.Port -eq '6543') { Stop-Clone "$($a.Name) uses port 6543 (Transaction pooler). Use the Session pooler address (port 5432) instead." }
    }
    Write-Ok 'The two addresses are different.'

    $runDir = Join-Path $ScriptDir (Join-Path 'runs' (Get-Date -Format 'yyyy-MM-dd_HHmmss'))
    New-Item -ItemType Directory -Path $runDir -Force | Out-Null
    try { Start-Transcript -Path (Join-Path $runDir 'log.txt') | Out-Null; $transcript = $true } catch { }
    Write-Info "Working folder for this run: $runDir"

    # --------------------------------------------------------------- step 3
    Write-Step '3' 'Look at both databases (read-only) and check that everything needed is there'
    $mainFacts = @(ConvertFrom-Facts @(Invoke-Query $mainUrl @((Join-Path $SqlDir 'inspect.sql')) (Join-Path $runDir 'main-inspect.txt') 'Reading MAIN' -ReadOnly))
    $testFacts = @(ConvertFrom-Facts @(Invoke-Query $testUrl @((Join-Path $SqlDir 'inspect.sql')) (Join-Path $runDir 'test-inspect.txt') 'Reading TEST' -ReadOnly))
    Write-Ok 'Connected to both databases.'

    if ((Get-Fact $mainFacts 'info' 'fingerprint') -eq (Get-Fact $testFacts 'info' 'fingerprint')) {
        Stop-Clone 'The two addresses lead to the SAME database server (identical fingerprint).'
    }
    $mainVersion = [int](Get-Fact $mainFacts 'info' 'version')
    $testVersion = [int](Get-Fact $testFacts 'info' 'version')
    $currentUser = Get-Fact $testFacts 'info' 'user'
    Write-Info "MAIN runs Postgres $([math]::Floor($mainVersion / 10000)), TEST runs Postgres $([math]::Floor($testVersion / 10000)); you are '$currentUser' on TEST"
    foreach ($v in @($mainVersion, $testVersion)) {
        if ([math]::Floor($v / 10000) -gt $toolMajor) { Stop-Clone "A database runs Postgres $([math]::Floor($v / 10000)) but your pg_dump is $toolMajor. Install Postgres $([math]::Floor($v / 10000)) client tools." }
    }
    if ([math]::Floor($mainVersion / 10000) -ne [math]::Floor($testVersion / 10000)) {
        Write-Warn 'MAIN and TEST run different Postgres major versions. The copy usually still works, but it is worth upgrading TEST in its dashboard.'
    }
    if ((Get-Fact $mainFacts 'info' 'bypassrls') -ne 'true') {
        Write-Warn "On MAIN, '$((Get-Fact $mainFacts 'info' 'user'))' cannot bypass row level security; pg_dump may refuse to read tables with RLS."
    }

    # which schemas
    $copySchemas = @(@(Get-Facts $mainFacts 'schema') | ForEach-Object { $_.A })
    $wipeSchemas = @(@(Get-Facts $testFacts 'schema') | ForEach-Object { $_.A })

    # extensions
    $mainExt = @{}; foreach ($f in @(Get-Facts $mainFacts 'ext')) { $mainExt[$f.A] = $f.B }
    $testExt = @{}; foreach ($f in @(Get-Facts $testFacts 'ext')) { $testExt[$f.A] = $f.B }
    $testAvail = @{}; foreach ($f in @(Get-Facts $testFacts 'avail')) { $testAvail[$f.A] = $true }
    $extLines = @('-- Extensions MAIN uses, made sure to exist on TEST before the structure is loaded.')
    $extToEnable = @()
    foreach ($name in ($mainExt.Keys | Sort-Object)) {
        $schema = $mainExt[$name]
        if ($testExt.ContainsKey($name) -and $testExt[$name] -ne $schema) {
            Stop-Clone "Extension '$name' is in schema '$schema' on MAIN but in '$($testExt[$name])' on TEST. Make them match first (Dashboard > Database > Extensions: disable it on TEST and enable it again choosing schema '$schema')."
        }
        $inCustomSchema = ($copySchemas -contains $schema) -and ($schema -ne 'public')
        if ($testExt.ContainsKey($name) -and -not $inCustomSchema) { continue }
        if (-not $testAvail.ContainsKey($name)) { Stop-Clone "MAIN uses extension '$name', which is not available on TEST's server." }
        if ($inCustomSchema) { $extLines += "CREATE SCHEMA IF NOT EXISTS $(Quote-Ident $schema);" }
        if ($schema -eq 'pg_catalog') { $extLines += "CREATE EXTENSION IF NOT EXISTS $(Quote-Ident $name) CASCADE;" }
        else { $extLines += "CREATE EXTENSION IF NOT EXISTS $(Quote-Ident $name) WITH SCHEMA $(Quote-Ident $schema) CASCADE;" }
        if (-not $testExt.ContainsKey($name)) { $extToEnable += "$name (in schema $schema)" }
    }
    Write-Ok "Extensions checked: $($mainExt.Count) used on MAIN, $($extToEnable.Count) will be enabled on TEST."

    # roles that your grants and policies mention must exist on TEST
    $testRoles = @(@(Get-Facts $testFacts 'role') | ForEach-Object { $_.A })
    $missingRoles = @(@(Get-Facts $mainFacts 'usedrole') | ForEach-Object { $_.A } | Where-Object { $testRoles -notcontains $_ })
    if ($missingRoles.Count -gt 0) {
        Stop-Clone "MAIN gives permissions to role(s) that do not exist on TEST: $($missingRoles -join ', '). Create them on TEST first (SQL editor: CREATE ROLE name;)."
    }
    Write-Ok 'Every role your permissions and policies use exists on TEST.'

    # auth / storage tables: TEST must have every column MAIN's data has
    # storage tables: copied only if postgres may read them on MAIN and add/delete rows on TEST
    $testWritable = @(@(Get-Facts $testFacts 'storagetable') | Where-Object { $_.Line.Split("`t")[3] -eq 'true' } | ForEach-Object { $_.A })
    $copyStorage = @(); $skippedStorage = @()
    foreach ($f in @(Get-Facts $mainFacts 'storagetable')) {
        if ($f.B -eq 'true' -and $testWritable -contains $f.A) { $copyStorage += $f.A } else { $skippedStorage += $f.A }
    }
    foreach ($needed in @('buckets', 'objects')) {
        if ($copyStorage -notcontains $needed) { Stop-Clone "storage.$needed cannot be copied: postgres may not read it on MAIN or may not change it on TEST." }
    }
    if ($skippedStorage.Count -gt 0) {
        Write-Info "Skipped storage tables postgres is not allowed to change (newer Supabase features, normally empty): $(($skippedStorage | ForEach-Object { "storage.$_" }) -join ', ')"
    }
    $testCols = New-Object 'System.Collections.Generic.HashSet[string]'
    foreach ($f in @(Get-Facts $testFacts 'col')) { [void]$testCols.Add("$($f.A).$($f.B)") }
    $copyTables = @('auth.users', 'auth.identities') + @($copyStorage | ForEach-Object { "storage.$_" })
    foreach ($f in @(Get-Facts $mainFacts 'col')) {
        if ($copyTables -contains $f.A -and -not $testCols.Contains("$($f.A).$($f.B)")) {
            Stop-Clone "TEST's $($f.A) has no column '$($f.B)' (MAIN's does). TEST's Supabase is on an older version; wait for Supabase to update it or contact support."
        }
    }
    Write-Ok "Auth and storage tables match: will copy $($copyTables -join ', ')"

    # webhooks and functions that call URLs
    $webhooks = @(@(Get-Facts $mainFacts 'webhook') | ForEach-Object { $_.A })
    if ($webhooks.Count -gt 0) {
        if (-not (@(Get-Facts $testFacts 'hasschema') | Where-Object { $_.A -eq 'supabase_functions' })) {
            Stop-Clone "MAIN uses Database Webhooks ($($webhooks -join ', ')) but TEST has them switched off. In TEST's dashboard open Database > Webhooks and click 'Enable webhooks' once, then run this again."
        }
        Write-Warn "Database Webhooks will be copied AS IS, so on TEST they still call MAIN's URLs: $($webhooks -join ', '). Edit them in TEST's dashboard after the copy."
    }
    $httpCalls = @(@(Get-Facts $mainFacts 'httpcall') | ForEach-Object { $_.A })
    if ($httpCalls.Count -gt 0) {
        Write-Warn "These functions call web addresses; check they don't point at MAIN/production on TEST: $($httpCalls -join ', ')"
    }

    # can we switch triggers off for the data load on TEST? (tried inside a transaction that is rolled back)
    $probe = Join-Path $runDir 'test-probe.txt'
    $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try { & $Psql -X -q -d $testUrl -v ON_ERROR_STOP=1 -o $probe -c 'BEGIN' -c 'SET LOCAL session_replication_role = replica' -c 'ROLLBACK' }
    finally { $ErrorActionPreference = $old }
    if ($LASTEXITCODE -ne 0) { Stop-Clone "On TEST, '$currentUser' may not use session_replication_role = replica, which is needed to load data without firing triggers twice." }
    Write-Ok 'TEST allows loading data with triggers paused (session_replication_role = replica).'

    if ($VerifyOnly) { Write-Info 'Verify-only run: skipping straight to the comparison. Nothing will be changed.' }
    else {
        # --------------------------------------------------------------- step 4
        Write-Step '4' 'The plan'
        Write-Host ''
        Write-Host "  FROM  MAIN  $($main.Display)   (only read, never changed)"
        Write-Host "  INTO  TEST  $($test.Display)"
        Write-Host ''
        Write-Host '  Your schemas copied from MAIN (structure first, then data):'
        foreach ($f in @(Get-Facts $mainFacts 'schema')) { Write-Host ("     - {0,-30} {1} tables" -f $f.A, $f.B) }
        Write-Host ("  Plus: auth.users ({0}), auth.identities ({1}), storage.buckets ({2}), storage.objects records ({3})" -f `
            (Get-Fact $mainFacts 'count' 'auth.users'), (Get-Fact $mainFacts 'count' 'auth.identities'),
            (Get-Fact $mainFacts 'count' 'storage.buckets'), (Get-Fact $mainFacts 'count' 'storage.objects'))
        Write-Host '  Plus: your triggers on auth/storage tables, storage policies, Realtime table settings.'
        if ($extToEnable.Count -gt 0) { Write-Host "  Extensions that will be enabled on TEST: $($extToEnable -join ', ')" }
        Write-Host ''
        Write-Host '  ON TEST, THIS DELETES:' -ForegroundColor Yellow
        foreach ($s in $wipeSchemas) {
            if ($s -eq 'public') { Write-Host '     - everything inside schema public (the schema itself and its Supabase permissions stay)' -ForegroundColor Yellow }
            else { Write-Host "     - schema $s and everything in it" -ForegroundColor Yellow }
        }
        Write-Host ("     - all {0} auth users (and their identities/sessions) and all {1} storage records on TEST" -f `
            (Get-Fact $testFacts 'count' 'auth.users'), (Get-Fact $testFacts 'count' 'storage.objects')) -ForegroundColor Yellow
        Write-Host '  Supabase''s own schemas (auth, storage, extensions, realtime, vault, ...) are not dropped.'
        Write-Host '  It all happens in ONE transaction: if any step fails, TEST stays exactly as it is now.'
        Write-Host ''

        if ($CheckOnly) {
            Write-Ok 'Check-only run finished. Nothing was changed. Run again without -CheckOnly to do the copy.'
            $exitCode = 0
            return
        }
        $answer = Read-Host "Type YES to replace TEST ($($test.Display)) with a copy of MAIN"
        if ($answer -cne 'YES') { Stop-Clone 'You did not type YES, so nothing was done.' }

        # --------------------------------------------------------------- step 5
        Write-Step '5' 'Export from MAIN (read-only)'
        $filter1 = Join-Path $runDir 'filter-your-schemas.txt'
        Write-TextFile $filter1 @($copySchemas | ForEach-Object { 'include schema ' + (Quote-Ident $_) })
        $filter2 = Join-Path $runDir 'filter-auth-storage.txt'
        Write-TextFile $filter2 @($copyTables | ForEach-Object { $p = $_.Split('.'); 'include table ' + (Quote-Ident $p[0]) + '.' + (Quote-Ident $p[1]) })

        $mainDump = Join-Path $runDir 'main-your-schemas.dump'
        Write-Info 'pg_dump: one snapshot of your schemas (structure + data) ...'
        Invoke-PgTool $PgDump @('-d', $mainUrl, '--format=custom', "--filter=$filter1",
                                '--no-publications', '--no-subscriptions', '--no-security-labels', '-f', $mainDump) 'pg_dump of your schemas'
        $authRaw = Join-Path $runDir 'main-auth-storage-data.raw.sql'
        Write-Info 'pg_dump: auth users/identities + storage buckets/objects (data only) ...'
        Invoke-PgTool $PgDump @('-d', $mainUrl, '--data-only', "--filter=$filter2", '-f', $authRaw) 'pg_dump of auth/storage data'
        $extrasFile = Join-Path $runDir '5-extras.sql'
        $mainSettings = Join-Path $runDir 'settings-main.sql'
        Write-TextFile $mainSettings @("SELECT $(Quote-Literal (ConvertTo-JsonList $copySchemas)) AS copy_schemas \gset")
        [void](Invoke-Query $mainUrl @($mainSettings, (Join-Path $SqlDir 'make-extras.sql')) $extrasFile 'Reading triggers/policies/Realtime from MAIN' -ReadOnly)
        Write-Ok 'Export finished.'

        # --------------------------------------------------------------- step 6
        Write-Step '6' 'Prepare the import files'
        $structRaw  = Join-Path $runDir 'main-structure.raw.sql'
        $dataRaw    = Join-Path $runDir 'main-your-schemas-data.raw.sql'
        Invoke-PgTool $PgRestore @('--schema-only', '--no-owner', '-f', $structRaw, $mainDump) 'pg_restore (structure)'
        Invoke-PgTool $PgRestore @('--data-only',   '--no-owner', '-f', $dataRaw,   $mainDump) 'pg_restore (data)'

        $f0 = Join-Path $runDir '0-settings.sql'
        Write-TextFile $f0 @(
            '-- wipe_schemas: TEST''s own schemas, as shown before you typed YES (used by reset-test.sql)',
            '-- copy_schemas: MAIN''s schemas being copied (used by check-foreign-keys.sql)',
            "SELECT $(Quote-Literal (ConvertTo-JsonList $wipeSchemas)) AS wipe_schemas \gset",
            "SELECT $(Quote-Literal (ConvertTo-JsonList $copySchemas)) AS copy_schemas \gset")
        $f3 = Join-Path $runDir '3-extensions.sql'
        Write-TextFile $f3 $extLines
        $f4 = Join-Path $runDir '4-structure.sql'
        $removedLog = Join-Path $runDir 'removed-lines.txt'
        if (Test-Path -LiteralPath $removedLog) { Remove-Item -LiteralPath $removedLog }
        $s = Convert-StructureFile $structRaw $f4 $removedLog $currentUser
        Write-Ok "Structure file ready; $($s.Removed) lines left out (see removed-lines.txt for each line and why)."

        $f6 = Join-Path $runDir '6-data-start.sql'
        Write-TextFile $f6 @(
            '-- From here on, load data with triggers and foreign-key checks paused (this session only),',
            '-- so the order of tables does not matter and signup triggers do not create duplicate rows.',
            'SET session_replication_role = replica;')
        $counts = [ordered]@{}
        $f7 = Join-Path $runDir '7-data-your-schemas.sql'
        Convert-DataFile $dataRaw $f7 $counts
        $f8 = Join-Path $runDir '8-data-auth-storage.sql'
        Convert-DataFile $authRaw $f8 $counts

        $finish = @('-- Back to normal mode, fill materialized views, then check every table got exactly the rows in the files.',
                    'SET session_replication_role = origin;')
        $finish += $s.Refresh
        $finish += 'DO $check$ DECLARE n bigint; BEGIN'
        foreach ($t in $counts.Keys) {
            $lit = Quote-Literal $t
            $finish += "  SELECT count(*) INTO n FROM ONLY $t; IF n <> $($counts[$t]) THEN RAISE EXCEPTION 'Row check failed for %: expected $($counts[$t]), found %', $lit, n; END IF;"
        }
        $finish += 'END $check$;'
        $f9 = Join-Path $runDir '9-finish.sql'
        Write-TextFile $f9 $finish
        $totalRows = 0; foreach ($v in $counts.Values) { $totalRows += $v }
        Write-Ok "Data files ready: $($counts.Count) tables, $totalRows rows."

        # --------------------------------------------------------------- step 7
        Write-Step '7' 'Import into TEST (one transaction: reset, structure, then data)'
        Write-Info 'If anything fails here, Postgres throws the whole transaction away and TEST is unchanged.'
        $importArgs = @('-X', '-q', '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-d', $testUrl,
                        '-o', (Join-Path $runDir 'import-output.txt'),
                        '-f', $f0, '-f', (Join-Path $SqlDir 'reset-test.sql'), '-f', $f3, '-f', $f4,
                        '-f', $extrasFile, '-f', $f6, '-f', $f7, '-f', $f8, '-f', $f9,
                        '-f', (Join-Path $SqlDir 'check-foreign-keys.sql'))
        try {
            Invoke-PgTool $Psql $importArgs 'Import into TEST'
        } catch {
            Stop-Clone "The import failed, so it was rolled back. $($_.Exception.Message) The files are kept in $runDir."
        }
        Write-Ok 'Import committed: TEST now holds the copy.'
        Write-Info "What the reset removed from TEST is listed in $(Join-Path $runDir 'import-output.txt')"
    }   # end of "not VerifyOnly"

    # --------------------------------------------------------------- step 8
    Write-Step '8' 'Compare MAIN and TEST'
    $vs = Join-Path $runDir 'settings-verify.sql'
    $sameMajor = if ([math]::Floor($mainVersion / 10000) -eq [math]::Floor($testVersion / 10000)) { 'true' } else { 'false' }
    Write-TextFile $vs @("SELECT $(Quote-Literal (ConvertTo-JsonList $copySchemas)) AS copy_schemas \gset",
                         "SELECT '$sameMajor' AS same_major \gset")
    $mainV = @(Invoke-Query $mainUrl @($vs, (Join-Path $SqlDir 'verify.sql')) (Join-Path $runDir 'verify-main.txt') 'Fingerprinting MAIN' -ReadOnly)
    $testV = @(Invoke-Query $testUrl @($vs, (Join-Path $SqlDir 'verify.sql')) (Join-Path $runDir 'verify-test.txt') 'Fingerprinting TEST' -ReadOnly)
    $mainSet = New-Object 'System.Collections.Generic.HashSet[string]'; foreach ($l in $mainV) { [void]$mainSet.Add($l) }
    $testSet = New-Object 'System.Collections.Generic.HashSet[string]'; foreach ($l in $testV) { [void]$testSet.Add($l) }
    $onlyMain = @($mainV | Where-Object { -not $testSet.Contains($_) })
    $onlyTest = @($testV | Where-Object { -not $mainSet.Contains($_) })

    Write-Host ''
    Write-Host ('  {0,-52} {1,10} {2,10}' -f 'table', 'MAIN rows', 'TEST rows')
    $mainRows = @{}; foreach ($l in $mainV) { $p = $l.Split("`t"); if ($p[0] -eq 'rows') { $mainRows[$p[1]] = $p[2] } }
    $testRows = @{}; foreach ($l in $testV) { $p = $l.Split("`t"); if ($p[0] -eq 'rows') { $testRows[$p[1]] = $p[2] } }
    foreach ($t in ($mainRows.Keys | Sort-Object)) {
        $mr = $mainRows[$t].Split(' ')[0]
        $tr = if ($testRows.ContainsKey($t)) { $testRows[$t].Split(' ')[0] } else { '-' }
        $same = if ($testRows.ContainsKey($t) -and $testRows[$t] -eq $mainRows[$t]) { 'same' } else { 'DIFFERENT' }
        $color = if ($same -eq 'same') { 'Gray' } else { 'Yellow' }
        Write-Host ('  {0,-52} {1,10} {2,10}   {3}' -f $t, $mr, $tr, $same) -ForegroundColor $color
    }
    Write-Host ''
    $kinds = @($mainV + $testV | ForEach-Object { $_.Split("`t")[0] } | Sort-Object -Unique)
    foreach ($k in $kinds) {
        $total = @($mainV | Where-Object { $_.Split("`t")[0] -eq $k }).Count
        $bad = @($onlyMain + $onlyTest | Where-Object { $_.Split("`t")[0] -eq $k }).Count
        if ($bad -eq 0) { Write-Ok ("{0,-13} {1} checked, all identical" -f $k, $total) }
        else { Write-Warn ("{0,-13} {1} checked, {2} differences" -f $k, $total, $bad) }
    }
    $report = @('Lines only in MAIN:') + @($onlyMain | ForEach-Object { "  $_" }) + @('', 'Lines only in TEST:') + @($onlyTest | ForEach-Object { "  $_" })
    Write-TextFile (Join-Path $runDir 'differences.txt') $report

    if ($onlyMain.Count + $onlyTest.Count -eq 0) {
        Write-Host ''
        Write-Ok 'TEST is an exact copy of MAIN: every row count, checksum, table, function, policy, trigger and permission matches.'
        $exitCode = 0
    } else {
        Write-Host ''
        if ($VerifyOnly) { Write-Warn "TEST differs from MAIN in $($onlyMain.Count + $onlyTest.Count) lines; see differences.txt in $runDir" }
        else { Write-Warn "The copy is in place, but $($onlyMain.Count + $onlyTest.Count) lines differ; see differences.txt in $runDir" }
        Write-Warn 'If your app was being used during the copy, small row differences in busy tables are expected; run again at a quiet time.'
        $exitCode = 2
    }

    # --------------------------------------------------------------- clean up
    if (-not $KeepFiles -and -not $VerifyOnly) {
        foreach ($f in @($mainDump, $dataRaw, $authRaw, $f7, $f8)) { if (Test-Path -LiteralPath $f) { Remove-Item -LiteralPath $f } }
        Write-Info 'Deleted the exported data files (they contain personal data). Use -KeepFiles to keep them.'
    }
    Write-Host ''
    if (-not $VerifyOnly) { Write-Host 'Still to do by hand in TEST''s dashboard (see README): auth providers & redirect URLs, Storage files, Edge Functions, secrets.' -ForegroundColor Cyan }
}
catch {
    if ($_.Exception.Message -ne 'clone-db stopped') {
        Write-Host ''
        Write-Host "STOPPED: $($_.Exception.Message)" -ForegroundColor Red
    }
    $exitCode = 1
}
finally {
    foreach ($k in $savedEnv.Keys) { [Environment]::SetEnvironmentVariable($k, $savedEnv[$k]) }
    if ($transcript) { try { Stop-Transcript | Out-Null } catch { } }
}
exit $exitCode
