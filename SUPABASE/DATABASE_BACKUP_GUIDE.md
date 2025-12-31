# Database Backup Guide

**IMPORTANT:** Always backup your database before running any migrations!

## Option 1: Supabase Dashboard (Recommended - Easiest)

### Automated Backups (Already Enabled)
Supabase automatically creates daily backups. However, for migrations, you should create a manual backup.

### Manual Backup via Dashboard

1. **Log in to Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Navigate to Database Backups**
   - Click on **Settings** (gear icon) in the left sidebar
   - Click on **Database** in the settings menu
   - Scroll to **Backups** section

3. **Create Point-in-Time Backup**
   - Click **Create backup** or **New backup**
   - Give it a descriptive name like: `pre_twitter_migration_YYYY-MM-DD`
   - Wait for the backup to complete (usually takes a few minutes)

4. **Verify Backup**
   - Check the backups list to confirm your backup appears
   - Note the backup timestamp

### Restore from Backup (if needed)
1. Go to **Settings** → **Database** → **Backups**
2. Find your backup in the list
3. Click **Restore** (or use the restore option)
4. **WARNING:** Restoring will overwrite your current database!

---

## Option 2: Supabase CLI (For Developers)

### Prerequisites
```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref
```

### Create Backup with pg_dump

```bash
# Get your database connection string from Supabase Dashboard
# Settings → Database → Connection string → URI

# Create backup
pg_dump "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  --file=backup_pre_twitter_migration_$(date +%Y%m%d_%H%M%S).sql \
  --verbose

# Or using Supabase CLI (if you have direct access)
supabase db dump --file backup_pre_twitter_migration.sql
```

### Restore from Backup
```bash
# Restore from SQL file
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  < backup_pre_twitter_migration_YYYYMMDD_HHMMSS.sql

# Or using Supabase CLI
supabase db reset --file backup_pre_twitter_migration.sql
```

---

## Option 3: Using Supabase Dashboard SQL Editor

### Export Specific Tables (Manual Method)

1. **Go to SQL Editor** in Supabase Dashboard
2. **Run export queries** for critical tables:

```sql
-- Export contests table structure and data
COPY (
  SELECT * FROM contests
) TO STDOUT WITH CSV HEADER;

-- Export creator_profiles table
COPY (
  SELECT * FROM creator_profiles
) TO STDOUT WITH CSV HEADER;

-- Export users table
COPY (
  SELECT * FROM users
) TO STDOUT WITH CSV HEADER;
```

**Note:** This method exports to CSV, not a full database backup. Use this only if other methods aren't available.

---

## Option 4: Using pgAdmin or DBeaver

If you have a database client tool:

1. **Connect to your Supabase database**
   - Host: `[YOUR-PROJECT-REF].supabase.co`
   - Port: `5432`
   - Database: `postgres`
   - Username: `postgres`
   - Password: (from Supabase Dashboard → Settings → Database)

2. **Create Backup**
   - Right-click on database → **Backup**
   - Choose filename: `backup_pre_twitter_migration.sql`
   - Select format: **Plain** or **Custom**
   - Click **Backup**

3. **Restore from Backup**
   - Right-click on database → **Restore**
   - Select your backup file
   - Click **Restore**

---

## Quick Backup Script (Bash)

Save this as `backup_db.sh`:

```bash
#!/bin/bash

# Configuration
PROJECT_REF="your-project-ref"
DB_PASSWORD="your-db-password"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Create backup
echo "Creating database backup..."
pg_dump "postgresql://postgres:${DB_PASSWORD}@${PROJECT_REF}.supabase.co:5432/postgres" \
  --file="$BACKUP_FILE" \
  --verbose

if [ $? -eq 0 ]; then
  echo "✅ Backup created successfully: $BACKUP_FILE"
  echo "Backup size: $(du -h "$BACKUP_FILE" | cut -f1)"
else
  echo "❌ Backup failed!"
  exit 1
fi
```

Make it executable and run:
```bash
chmod +x backup_db.sh
./backup_db.sh
```

---

## Verification Checklist

After creating a backup, verify it:

- [ ] **Backup file exists** and has a reasonable size (not 0 bytes)
- [ ] **Backup timestamp** is recent (just created)
- [ ] **Can see backup** in Supabase Dashboard (if using dashboard method)
- [ ] **Test restore** in a test/staging environment (optional but recommended)

---

## Important Notes

1. **Backup Size**: Large databases may take time to backup. Be patient.

2. **Storage**: Backups can be large. Make sure you have enough disk space.

3. **Timing**: Create the backup right before running the migration, not days before.

4. **Multiple Backups**: It's safe to have multiple backups. Keep at least:
   - One before migration
   - One from before major changes (if you have it)

5. **Production vs Staging**: 
   - If you have a staging environment, test the migration there first
   - Always backup production before any changes

6. **Automated Backups**: Supabase Pro plan includes automatic daily backups, but manual backups before migrations are still recommended.

---

## Quick Reference: Get Connection String

1. Go to Supabase Dashboard
2. **Settings** → **Database**
3. Scroll to **Connection string**
4. Copy the **URI** connection string
5. Replace `[YOUR-PASSWORD]` with your actual database password

Example format:
```
postgresql://postgres:[YOUR-PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres
```

---

## Emergency Restore

If something goes wrong during migration:

1. **Stop all application traffic** (if possible)
2. **Do NOT run any more migrations**
3. **Restore from backup** using one of the methods above
4. **Verify data integrity** after restore
5. **Investigate what went wrong** before trying again

---

## Next Steps

After creating your backup:

1. ✅ Verify backup was successful
2. ✅ Note the backup location/name
3. ✅ Proceed with migration: `migrate_twitter_to_main.sql`
4. ✅ Test the migration results
5. ✅ Keep the backup until you're confident everything works
