# 📘 Database Schema Backup & Export Guide

## 🎯 Why Backup Your Schema?

Keeping your **database schema** in the repo ensures:
- Developers (and AI assistants 😉) always understand your DB structure
- Schema changes are tracked in Git (like code changes)
- Easy onboarding for new contributors
- Disaster recovery capabilities
- Team collaboration on database changes

---

## 🛠️ Setup Instructions

### 1. Install PostgreSQL Tools

#### Windows (via Scoop):
```powershell
# Install Scoop if you don't have it
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression

# Install PostgreSQL
scoop install postgresql

# Verify installation
pg_dump --version
```

#### Windows (via Chocolatey):
```powershell
# Install PostgreSQL
choco install postgresql

# Verify installation
pg_dump --version
```

#### Mac (Homebrew):
```bash
# Install PostgreSQL
brew install postgresql

# Verify installation
pg_dump --version
```

#### Ubuntu/Debian:
```bash
# Install PostgreSQL client
sudo apt update
sudo apt install postgresql-client

# Verify installation
pg_dump --version
```

---

## 📋 Backup Methods

### Method 1: Schema-Only Backup (Recommended)

**Purpose**: Export only the database structure (tables, indexes, functions, etc.) without data.

```powershell
# Basic command structure
pg_dump --schema=public --schema=auth --schema=storage --no-owner --no-privileges --schema-only "postgresql://username:password@host:port/database" > output_file.sql

# Your specific command (replace with your actual credentials)
pg_dump --schema=public --schema=auth --schema=storage --no-owner --no-privileges --schema-only "postgresql://postgres:Jaihanumanji2@db.rjprmbjqetxkramwbrqo.supabase.co:5432/postgres" > db/schema.sql
```

**What this exports:**
- ✅ Table structures
- ✅ Indexes and constraints
- ✅ Functions and triggers
- ✅ Views and sequences
- ❌ No data (rows)
- ❌ No ownership/privileges (makes it portable)

---

### Method 2: Full Database Backup (Data + Schema)

**Purpose**: Complete backup including all data.

```powershell
# Full backup command
pg_dump --schema=public --schema=auth --schema=storage --no-owner --no-privileges "postgresql://postgres:Jaihanumanji2@db.rjprmbjqetxkramwbrqo.supabase.co:5432/postgres" > db/full_backup_$(Get-Date -Format 'yyyy-MM-dd_HH-mm-ss').sql

# Compressed backup (smaller file size)
pg_dump --schema=public --schema=auth --schema=storage --no-owner --no-privileges "postgresql://postgres:Jaihanumanji2@db.rjprmbjqetxkramwbrqo.supabase.co:5432/postgres" | gzip > db/full_backup_$(Get-Date -Format 'yyyy-MM-dd_HH-mm-ss').sql.gz
```

---

### Method 3: Selective Table Backup

**Purpose**: Backup only specific tables.

```powershell
# Backup specific tables
pg_dump --schema=public --no-owner --no-privileges --table=users --table=contests --table=submissions "postgresql://postgres:Jaihanumanji2@db.rjprmbjqetxkramwbrqo.supabase.co:5432/postgres" > db/selective_backup.sql
```

---

## 🤖 Automation Scripts

### PowerShell Script (Windows)

Create `scripts/backup-schema.ps1`:

```powershell
# Database backup script
param(
    [string]$BackupType = "schema",  # schema, full, or selective
    [string]$OutputDir = "db/backups"
)

# Configuration
$DB_URL = "postgresql://postgres:Jaihanumanji2@db.rjprmbjqetxkramwbrqo.supabase.co:5432/postgres"
$Timestamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'

# Create output directory if it doesn't exist
if (!(Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force
}

try {
    switch ($BackupType) {
        "schema" {
            $OutputFile = "$OutputDir/schema_$Timestamp.sql"
            pg_dump --schema=public --schema=auth --schema=storage --no-owner --no-privileges --schema-only $DB_URL > $OutputFile
            Write-Host "✅ Schema backup created: $OutputFile" -ForegroundColor Green
        }
        "full" {
            $OutputFile = "$OutputDir/full_backup_$Timestamp.sql"
            pg_dump --schema=public --schema=auth --schema=storage --no-owner --no-privileges $DB_URL > $OutputFile
            Write-Host "✅ Full backup created: $OutputFile" -ForegroundColor Green
        }
        "selective" {
            $OutputFile = "$OutputDir/selective_backup_$Timestamp.sql"
            pg_dump --schema=public --no-owner --no-privileges --table=users --table=contests --table=submissions --table=creator_profiles $DB_URL > $OutputFile
            Write-Host "✅ Selective backup created: $OutputFile" -ForegroundColor Green
        }
        default {
            Write-Host "❌ Invalid backup type. Use: schema, full, or selective" -ForegroundColor Red
            exit 1
        }
    }
    
    # Get file size
    $FileSize = (Get-Item $OutputFile).Length
    $FileSizeMB = [math]::Round($FileSize / 1MB, 2)
    Write-Host "📊 File size: $FileSizeMB MB" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ Backup failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
```

**Usage:**
```powershell
# Schema backup
.\scripts\backup-schema.ps1 -BackupType schema

# Full backup
.\scripts\backup-schema.ps1 -BackupType full

# Selective backup
.\scripts\backup-schema.ps1 -BackupType selective
```

---

### Bash Script (Mac/Linux)

Create `scripts/backup-schema.sh`:

```bash
#!/bin/bash

# Database backup script
BACKUP_TYPE=${1:-"schema"}  # schema, full, or selective
OUTPUT_DIR="db/backups"
DB_URL="postgresql://postgres:Jaihanumanji2@db.rjprmbjqetxkramwbrqo.supabase.co:5432/postgres"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

case $BACKUP_TYPE in
    "schema")
        OUTPUT_FILE="$OUTPUT_DIR/schema_$TIMESTAMP.sql"
        pg_dump --schema=public --schema=auth --schema=storage --no-owner --no-privileges --schema-only "$DB_URL" > "$OUTPUT_FILE"
        echo "✅ Schema backup created: $OUTPUT_FILE"
        ;;
    "full")
        OUTPUT_FILE="$OUTPUT_DIR/full_backup_$TIMESTAMP.sql"
        pg_dump --schema=public --schema=auth --schema=storage --no-owner --no-privileges "$DB_URL" > "$OUTPUT_FILE"
        echo "✅ Full backup created: $OUTPUT_FILE"
        ;;
    "selective")
        OUTPUT_FILE="$OUTPUT_DIR/selective_backup_$TIMESTAMP.sql"
        pg_dump --schema=public --no-owner --no-privileges --table=users --table=contests --table=submissions --table=creator_profiles "$DB_URL" > "$OUTPUT_FILE"
        echo "✅ Selective backup created: $OUTPUT_FILE"
        ;;
    *)
        echo "❌ Invalid backup type. Use: schema, full, or selective"
        exit 1
        ;;
esac

# Get file size
FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
echo "📊 File size: $FILE_SIZE"
```

**Usage:**
```bash
# Make executable
chmod +x scripts/backup-schema.sh

# Schema backup
./scripts/backup-schema.sh schema

# Full backup
./scripts/backup-schema.sh full

# Selective backup
./scripts/backup-schema.sh selective
```

---

## 📅 Automated Backup Schedule

### Windows Task Scheduler

1. **Open Task Scheduler** (search "Task Scheduler" in Start menu)
2. **Create Basic Task**:
   - Name: "Database Schema Backup"
   - Description: "Daily schema backup for GoViral project"
   - Trigger: Daily at 2:00 AM
   - Action: Start a program
   - Program: `powershell.exe`
   - Arguments: `-File "C:\path\to\your\project\scripts\backup-schema.ps1" -BackupType schema`

### Mac/Linux Cron

```bash
# Edit crontab
crontab -e

# Add daily schema backup at 2 AM
0 2 * * * cd /path/to/your/project && ./scripts/backup-schema.sh schema

# Add weekly full backup on Sunday at 3 AM
0 3 * * 0 cd /path/to/your/project && ./scripts/backup-schema.sh full
```

---

## 🚨 Emergency Recovery

### Restore from Schema Backup

```powershell
# Restore schema (structure only)
psql "postgresql://postgres:Jaihanumanji2@db.rjprmbjqetxkramwbrqo.supabase.co:5432/postgres" < db/schema.sql

# Restore full backup
psql "postgresql://postgres:Jaihanumanji2@db.rjprmbjqetxkramwbrqo.supabase.co:5432/postgres" < db/full_backup_2024-01-15_10-30-00.sql
```

### Restore to Local Database

```powershell
# Create local database
createdb goviral_local

# Restore schema
psql goviral_local < db/schema.sql

# Restore with data
psql goviral_local < db/full_backup_2024-01-15_10-30-00.sql
```

---

## 📊 Backup Validation

Create `scripts/validate-backup.ps1`:

```powershell
param(
    [string]$BackupFile
)

if (!(Test-Path $BackupFile)) {
    Write-Host "❌ Backup file not found: $BackupFile" -ForegroundColor Red
    exit 1
}

# Check if file is not empty
$FileSize = (Get-Item $BackupFile).Length
if ($FileSize -eq 0) {
    Write-Host "❌ Backup file is empty!" -ForegroundColor Red
    exit 1
}

# Check if it contains expected SQL statements
$Content = Get-Content $BackupFile -Raw
$ExpectedStatements = @("CREATE TABLE", "CREATE INDEX", "CREATE FUNCTION", "CREATE TRIGGER")

$FoundStatements = 0
foreach ($Statement in $ExpectedStatements) {
    if ($Content -match $Statement) {
        $FoundStatements++
    }
}

if ($FoundStatements -ge 2) {
    Write-Host "✅ Backup validation passed" -ForegroundColor Green
    Write-Host "📊 File size: $([math]::Round($FileSize / 1MB, 2)) MB" -ForegroundColor Cyan
    Write-Host "🔍 Found $FoundStatements SQL statement types" -ForegroundColor Cyan
} else {
    Write-Host "❌ Backup validation failed - file may be corrupted" -ForegroundColor Red
    exit 1
}
```

---

## 🔐 Security Best Practices

### 1. Environment Variables

Create `.env.backup`:
```bash
# Database credentials for backup
DB_HOST=db.rjprmbjqetxkramwbrqo.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=Jaihanumanji2
```

Update backup script to use environment variables:
```powershell
# Load environment variables
$EnvFile = ".env.backup"
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match "^([^#][^=]+)=(.*)$") {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
        }
    }
}

$DB_URL = "postgresql://$($env:DB_USER):$($env:DB_PASSWORD)@$($env:DB_HOST):$($env:DB_PORT)/$($env:DB_NAME)"
```

### 2. Backup Encryption

```powershell
# Encrypt backup file
$SecureString = Read-Host "Enter encryption password" -AsSecureString
$EncryptedFile = "$BackupFile.encrypted"
$BackupContent = Get-Content $BackupFile -Raw
$EncryptedContent = ConvertFrom-SecureString $SecureString
$BackupContent | ConvertTo-SecureString -AsPlainText -Force | ConvertFrom-SecureString | Out-File $EncryptedFile

Write-Host "✅ Backup encrypted: $EncryptedFile" -ForegroundColor Green
```

---

## 🚑 Troubleshooting

### Common Issues

1. **"pg_dump: command not found"**
   - Solution: Install PostgreSQL client tools (see setup section)

2. **"connection to server failed"**
   - Check your database URL and credentials
   - Verify network connectivity
   - Check if Supabase allows connections from your IP

3. **"permission denied"**
   - Ensure you're using the correct database user
   - Check if user has necessary permissions

4. **"empty backup file"**
   - Check if database is accessible
   - Verify schemas exist (public, auth, storage)
   - Try with different connection parameters

### Debug Commands

```powershell
# Test connection
psql "postgresql://postgres:Jaihanumanji2@db.rjprmbjqetxkramwbrqo.supabase.co:5432/postgres" -c "\l"

# List schemas
psql "postgresql://postgres:Jaihanumanji2@db.rjprmbjqetxkramwbrqo.supabase.co:5432/postgres" -c "\dn"

# List tables in public schema
psql "postgresql://postgres:Jaihanumanji2@db.rjprmbjqetxkramwbrqo.supabase.co:5432/postgres" -c "\dt public.*"
```

---

## 📝 Quick Reference

### Essential Commands

```powershell
# Schema backup
pg_dump --schema=public --schema=auth --schema=storage --no-owner --no-privileges --schema-only "postgresql://postgres:Jaihanumanji2@db.rjprmbjqetxkramwbrqo.supabase.co:5432/postgres" > db/schema.sql

# Full backup
pg_dump --schema=public --schema=auth --schema=storage --no-owner --no-privileges "postgresql://postgres:Jaihanumanji2@db.rjprmbjqetxkramwbrqo.supabase.co:5432/postgres" > db/backup_$(Get-Date -Format 'yyyy-MM-dd').sql

# Restore
psql "postgresql://postgres:Jaihanumanji2@db.rjprmbjqetxkramwbrqo.supabase.co:5432/postgres" < db/schema.sql
```

### File Organization

```
db/
├── schema.sql                    # Current schema snapshot
├── backups/
│   ├── schema_2024-01-15.sql    # Daily schema backups
│   ├── full_2024-01-15.sql      # Weekly full backups
│   └── selective_2024-01-15.sql # Selective backups
└── migrations/                   # Future migration files
```

---

✅ **With this guide, your team can confidently backup and restore your database schema, ensuring data safety and team collaboration!**
